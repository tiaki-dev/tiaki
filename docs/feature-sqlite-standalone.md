# Feature Improvement: SQLite als Standalone-Datenbank-Alternative

> **Status**: Proposal  
> **Erstellt**: 2026-03-20  
> **Aufwand**: ~3–5 Tage  
> **Priorität**: Nice-to-have

## Motivation

Tiaki nutzt aktuell PostgreSQL als einzige Datenbank. Für professionelle Deployments ist das korrekt — PostgreSQL kann auch als externer Server bereitgestellt werden. Für **Standalone-/Homelab-Installationen** ist ein separater PostgreSQL-Container jedoch unnötiger Overhead. Eine leichtgewichtige SQLite-Option würde die Einstiegshürde senken und den Ressourcenverbrauch reduzieren.

## Aktuelle Architektur

| Komponente | Technologie |
|------------|-------------|
| ORM | Drizzle ORM (`drizzle-orm/pg-core`) |
| DB-Driver | `pg` (node-postgres) mit Connection Pool |
| Schema | 7 Tabellen, 6 PostgreSQL Enums, 3 jsonb-Spalten |
| Migrationen | 9 SQL-Dateien (PostgreSQL-Dialekt) |
| Raw SQL | ~4 komplexe Queries mit PG-spezifischer Syntax |

## PostgreSQL-spezifische Features im Code

### Hoch aufwändig zu portieren

- **`pgEnum` (6 Enums)**: `agent_type`, `agent_status`, `update_status`, `notification_type`, `notification_status`, `audit_action` — SQLite hat keine nativen Enums, müssten als `text` + CHECK-Constraints abgebildet werden
- **Raw SQL mit PG-Casts**: `::text::update_status`-Casts in `update-results.ts` und `containers.ts`, PG-Systemtabellen (`pg_enum`, `information_schema`) in `verify-schema.ts`
- **Migrationen**: 9 PG-spezifische Migrationsdateien (`CREATE TYPE`, `ALTER TYPE ... ADD VALUE`) — müssten komplett neu für SQLite geschrieben werden

### Mittel aufwändig

- **`jsonb`-Spalten** (3 Stück): `agents.metadata`, `updateResults.vulnerabilities`, `notifications.updateResultIds` — SQLite speichert JSON als `text`, kein nativer JSON-Operator
- **`timestamp WITH TIME ZONE`**: Überall im Schema — SQLite hat keinen Timestamp-Typ, Drizzle's SQLite-Adapter nutzt `integer({ mode: 'timestamp' })`

### Gering aufwändig

- **`ILIKE`**: SQLite's `LIKE` ist standardmäßig case-insensitive für ASCII
- **`ON CONFLICT DO UPDATE`** (Upsert): SQLite unterstützt das nativ
- **`.returning()`**: SQLite unterstützt `RETURNING` ab Version 3.35+
- **Connection Pool**: Bei SQLite nicht nötig (`better-sqlite3` ist synchron)

## Aufwandsschätzung

| Bereich | Aufwand | Betroffene Dateien |
|---------|---------|-------------------|
| Duales Schema (pg + sqlite) | Hoch | `schema.ts` → + `schema-sqlite.ts` |
| DB-Adapter-Abstraktion | Mittel | `db/index.ts`, `drizzle.config.ts` |
| Enum → Text + CHECK | Hoch | Schema + alle Raw-SQL-Queries |
| jsonb → text/JSON | Mittel | Schema + Serialisierungs-Layer |
| Raw SQL portieren | Hoch | `containers.ts`, `update-results.ts` |
| verify-schema ersetzen | Mittel | `verify-schema.ts` |
| SQLite-Migrationen | Hoch | Komplett neuer Migrationssatz |
| Docker-Compose Standalone | Gering | Neue `docker-compose.standalone.yml` |
| Tests anpassen | Mittel | 3 Testdateien |

**Gesamt: ~3–5 Tage Entwicklungsarbeit**

## Empfohlene Umsetzungsstrategie

### Option A: Dualer Dialekt via Drizzle (empfohlen)

1. **Zwei Schema-Dateien**: `schema-pg.ts` (bestehend) + `schema-sqlite.ts` (neu) — pgEnum und jsonb unterscheiden sich fundamental
2. **Runtime-Switch**: Env-Variable `DB_DRIVER=postgres|sqlite` steuert welcher Adapter geladen wird
3. **Query-Abstraktion**: Die 3–4 Raw-SQL-Queries in adapter-spezifische Funktionen extrahieren
4. **SQLite-Driver**: `better-sqlite3` — synchron, schnell, zero-config
5. **Separate Migrationen**: Drizzle generiert pro Dialekt eigene Migrationen

### Option B: Embedded PostgreSQL

Alternativ könnte ein **Embedded PostgreSQL** (`embedded-postgres` npm-Paket) verwendet werden. PostgreSQL startet als Subprocess ohne separaten Container — kein duales Schema nötig, aber höherer Ressourcenverbrauch als SQLite.

## Risiken

| Risiko | Impact | Mitigation |
|--------|--------|------------|
| Doppelte Schema-Wartung | Hoch | Schema-Änderungen immer in beiden Dateien |
| Feature-Drift | Mittel | Neue PG-Features müssen SQLite-kompatibel sein |
| Test-Aufwand | Mittel | CI muss gegen beide DBs testen |
| JSON-Einschränkungen | Gering | Kein DB-Level JSON-Querying in SQLite |

## Deployment-Modelle nach Umsetzung

```
┌─────────────────────────────────────────────────┐
│  Professional / Team                            │
│  DB_DRIVER=postgres                             │
│  DATABASE_URL=postgresql://host:5432/tiaki      │
│  → Externer oder Container-PostgreSQL           │
├─────────────────────────────────────────────────┤
│  Standalone / Homelab                           │
│  DB_DRIVER=sqlite                               │
│  DATABASE_URL=./data/tiaki.db                   │
│  → Kein extra Container, Datei-basiert          │
└─────────────────────────────────────────────────┘
```

## Fazit

Die Umstellung ist **machbar, aber nicht trivial**. Der größte Aufwand liegt bei den 6 pgEnums, den Raw-SQL-Queries mit PG-Casts, und dem doppelten Migrationspfad. Der langfristige Wartungsaufwand durch duale Schema-Pflege sollte nicht unterschätzt werden.

Für den Start empfiehlt sich **Option A** (Dualer Dialekt), da SQLite den geringsten Overhead für Standalone-User bietet. Option B (Embedded PG) ist ein guter Fallback, falls die duale Wartung zu aufwändig wird.
