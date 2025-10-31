# GEMINI.md

## Project Overview

This repository contains the `vue-oidc` library, a fully OAuth 2.1 and OpenID Connect (OIDC) compliant library for Vue.js 3, and a sample implementation application.

The `vue-oidc` library provides support for the following OAuth 2.1 flows:
*   Resource Owner Password Credentials (ROPC)
*   Implicit
*   Authorization Code with PKCE
*   Client Credentials

The project is a monorepo with the library located in the `lib/` directory and the sample application in the `src/` directory.

**Key Technologies:**

*   **Framework:** Vue.js 3
*   **Build Tool:** Vite
*   **Language:** TypeScript
*   **Package Manager:** Bun
*   **Routing:** Vue Router
*   **UI:** Vuetify (for the optional `OAuth` component in the library and the sample app)
*   **State Management:** Pinia (implied by `vue-oidc`'s composables)
*   **Testing:** Vitest
*   **Linting & Formatting:** ESLint and Prettier

## Building and Running

The project uses `bun` for package management and running scripts. The following scripts are available in `package.json`:

*   `bun run dev`: Starts the development server for the sample application.
*   `bun run prod`: Starts the production server for the sample application.
*   `bun run build`: Builds both the `vue-oidc` library and the sample application.
*   `bun run test:unit`: Runs the unit tests for the project using Vitest.
*   `bun run lint`: Lints the entire project using ESLint.
*   `bun run format`: Formats the source code using Prettier.
*   `bun publish`: Builds and publishes the `vue-oidc` library.

## Development Conventions

*   **Code Style:** The project uses Prettier for automatic code formatting and ESLint for linting. The configuration in `eslint.config.ts` specifies that semicolons are not used.
*   **Structure:** The `vue-oidc` library is developed in the `lib/` directory, and the sample application that consumes it is in the `src/` directory. This allows for easy testing and development of the library.
*   **Library Usage:** The `vue-oidc` library is initialized by calling the `createOAuth` function and passing in the configuration. The library then provides several Vue composables (`useOAuth`, `useOAuthToken`, etc.) to access authentication state and functions within components.
*   **Configuration:** The sample application is configured using environment variables defined in `.env` files (e.g., `.env`, `.env.production`). These variables are prefixed with `VITE_` as is standard for Vite projects.
