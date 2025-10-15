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
