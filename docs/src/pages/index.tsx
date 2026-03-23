import type { ReactNode } from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";
import styles from "./index.module.css";

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx("hero hero--primary", styles.heroBanner)}>
      <div className="container">
        <img src="/img/logo.svg" alt="Tiaki Logo" className={styles.heroLogo} />
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/intro"
          >
            Get Started →
          </Link>
          <Link
            className="button button--outline button--lg"
            to="/docs/api"
            style={{ marginLeft: "1rem", color: "#fff", borderColor: "#fff" }}
          >
            API Reference
          </Link>
        </div>
      </div>
    </header>
  );
}

type FeatureItem = {
  title: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: "Automatic Update Detection",
    description:
      "Continuously monitors container registries for new image versions using digest and semver comparison.",
  },
  {
    title: "Automated Deployments & Rollbacks",
    description:
      "Deploy updates with a single click or configure auto-deployment. Instantly revert to previous versions if issues arise.",
  },
  {
    title: "Security Scanning",
    description:
      "Optional Trivy integration detects vulnerabilities before they reach production.",
  },
  {
    title: "Docker & Kubernetes",
    description:
      "Lightweight Go agents support both Docker Compose (VM) and Kubernetes environments.",
  },
  {
    title: "Audit Logging",
    description:
      "Complete history of all deployments, changes, and agent activity with full traceability.",
  },
  {
    title: "Git Integration",
    description:
      "Automatically commit docker-compose.yml changes to your repository for a full infrastructure-as-code audit trail.",
  },
];

function Feature({ title, description }: FeatureItem) {
  return (
    <div className={clsx("col col--4", styles.feature)}>
      <div className="padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="Automated container update management for Docker and Kubernetes"
    >
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
