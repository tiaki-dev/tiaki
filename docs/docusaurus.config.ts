import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import type * as OpenApiPlugin from "docusaurus-plugin-openapi-docs";

const config: Config = {
  title: "Tiaki",
  tagline: "Automated container update management for Docker and Kubernetes",
  favicon: "img/favicon.svg",

  url: "https://docs.tiaki.dev",
  baseUrl: "/",

  organizationName: "tiaki-dev",
  projectName: "tiaki",

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl: "https://github.com/tiaki-dev/tiaki/tree/main/docs/",
          docItemComponent: "@theme/ApiItem",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    function webpackNodePolyfillFix() {
      return {
        name: "webpack-node-polyfill-fix",
        configureWebpack() {
          return {
            resolve: {
              fallback: {
                path: false,
                fs: false,
                os: false,
                crypto: false,
                stream: false,
                buffer: false,
              },
            },
          };
        },
      };
    },
    [
      "docusaurus-plugin-openapi-docs",
      {
        id: "api",
        docsPluginId: "classic",
        config: {
          tiakiApi: {
            specPath: "../proto/api.yaml",
            outputDir: "docs/api",
            sidebarOptions: {
              groupPathsBy: "tag",
            },
          } satisfies OpenApiPlugin.Options,
        },
      },
    ],
  ],

  themes: ["docusaurus-theme-openapi-docs"],

  themeConfig: {
    image: "img/social-card.png",
    colorMode: {
      defaultMode: "dark",
      disableSwitch: false,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: "Tiaki",
      logo: {
        alt: "Tiaki Logo",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "docsSidebar",
          position: "left",
          label: "Docs",
        },
        {
          type: "docSidebar",
          sidebarId: "apiSidebar",
          position: "left",
          label: "API Reference",
        },
        {
          href: "https://github.com/tiaki-dev/tiaki",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            { label: "Getting Started", to: "/docs/intro" },
            { label: "Configuration", to: "/docs/configuration/control-plane" },
            { label: "API Reference", to: "/docs/api" },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "GitHub Issues",
              href: "https://github.com/tiaki-dev/tiaki/issues",
            },
            {
              label: "GitHub Discussions",
              href: "https://github.com/tiaki-dev/tiaki/discussions",
            },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/tiaki-dev/tiaki",
            },
            {
              label: "Changelog",
              href: "https://github.com/tiaki-dev/tiaki/blob/main/CHANGELOG.md",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Tiaki. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["bash", "yaml", "go", "typescript", "docker"],
    },
    algolia: undefined,
  } satisfies Preset.ThemeConfig,
};

export default config;
