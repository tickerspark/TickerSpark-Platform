# 🚀 TickerSpark Chat Platform

This repository contains the source code for the TickerSpark Chat application, providing a client-side Flutter application integrated with a Supabase PostgreSQL backend for financial data processing.

## 🌟 Application Summary

The TickerSpark platform leverages secure Edge Functions to execute complex logic outside the client environment.

| Core Service | Technology/Database | Functionality |
| :--- | :--- | :--- |
| **Chat Application** | Flutter / Dart | The core user interface for financial query input. |
| **Edge Functions** | TypeScript / Deno | Routes user queries, performs external API calls, and manages business logic (e.g., `chat-proxy`). |
| **Vector Search** | PostgreSQL / `pgvector` | Database functions (`match_documents`) and the `intelligent_documents` table enable RAG (Retrieval-Augmented Generation) for financial analysis. |
| **Background Queue** | PostgreSQL / `pgmq` | Manages asynchronous tasks (like embedding generation) for efficient data processing. |

---

## 📁 Repository Structure

The project maintains the standard Flutter app layout alongside the root `supabase` directory.

| Directory | Content | Description |
| :--- | :--- | :--- |
| **`lib/`** | Flutter App Source | Primary Dart code for the mobile frontend. |
| **`android/`, `ios/`** | Platform Projects | Native project files for Flutter builds. |
| **`supabase/functions/`** | Edge Functions | **Version-controlled** TypeScript code for all functions. |
| **`supabase/migrations/`**| Database Migrations | **Version-controlled** SQL schema (tables, functions, RLS policies). |

---

## 🛠️ CI/CD and Deployment Workflow

### 1. Edge Functions Deployment (Automated)

* **Trigger:** Pushes to the `supabase/functions/` directory.
* **Action:** The pipeline runs `supabase functions deploy`.
* **Result:** Your backend logic is updated on the Supabase Edge Network.

### 2. Frontend Deployment (Netlify Web Component)

* **Trigger:** (Typically the same `main` branch push that deploys the functions).
* **Platform:** Netlify's continuous deployment integration.
* **Build:** The CI/CD process executes the build command (`flutter build web`) to create the application artifacts.
* **Publish Directory:** The content is deployed from the standard Flutter output directory (`build/web`).
* **Result:** The live Flutter web application is updated on your Netlify URL.

### 3. Database Schema Management (Manual)

The database schema is **versioned in this repository** but is *not* pushed via CI/CD. The management is done entirely through the Supabase Dashboard.

| Action | Command / Location | Rationale |
| :--- | :--- | :--- |
| **Current Live Schema** | **Supabase Dashboard** | All schema changes (tables, functions, etc.) are executed directly in the SQL Editor or Table Editor UI. |
| **Local Backup** | `npx supabase db pull` | Used locally to **pull the current live schema** and commit the resulting migration file as a safety backup. |
| **Future Goal** | **Automated `db push`** | We aim to implement automated schema pushes via CI/CD once a secure, non-destructive strategy for our complex schema is fully validated. |

## 🛠️ Local Development Setup

To ensure full parity with the CI/CD pipeline and the live application, follow these steps to set up your local development environment.

### Prerequisites

1.  **Flutter SDK** (Latest Stable Channel)
2.  **Supabase CLI** (Installed globally via npm/Scoop)
3.  **Deno Runtime** (Installed globally)
4.  **Docker Desktop** (Required for local database testing via `supabase start`)
5.  **Project ID:** `nudsowxnijbygcmlcoyv` (Used in `supabase link`)
6.  **Initial Baseline Timestamp:** `20251015155632` (Used for initial history sync)

### Setup Commands (New Workstation)

1.  **Clone and Navigate to Repository Root:**
    ```bash
    # Clone the repository (adjust folder name if needed)
    git clone [https://github.com/tickerspark/Tickerspark-Platform.git](https://github.com/tickerspark/Tickerspark-Platform.git)
    cd Tickerspark-Platform
    ```

2.  **Connect to Supabase Project:** Log into the CLI and link the project.
    ```bash
    npx supabase login
    npx supabase link --project-ref nudsowxnijbygcmlcoyv
    ```

3.  **Synchronize Database History:** This step tells the remote database to trust your local schema history, preventing sync errors on this new machine. **(Use the initial baseline timestamp)**
    ```bash
    npx supabase migration repair --status applied 20251015155632
    ```

4.  **Flutter App Setup:** Navigate to the app directory and install dependencies.
    ```bash
    # Navigate to the app folder where pubspec.yaml is located
    cd apps/chat
    flutter pub get
    
    # Return to repository root for Git commands
    cd ../..
    ```

### Running Local Backend (Docker Required)

If you need to run and test the database, authentication, or storage services locally:

* **Start the Local Supabase Stack:**
    ```bash
    supabase start
    ```
    (This requires **Docker Desktop to be open and running**.)

* **Access Local Dashboard:** Once started, the services are available at `http://localhost:...`.
