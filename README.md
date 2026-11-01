# Developer portfolio

A static, multi-page portfolio built with Astro and Tailwind CSS. At build time it reads profile, experience, project, and skill documents from Firestore using the Firebase Admin SDK. The deployed site is static HTML/CSS and requires no client-side server.

The included data is illustrative sample content. Replace it with your own before publishing. When Firebase credentials are absent, local builds visibly warn and use the sample content so the site can be previewed without a cloud account. The deploy workflow requires Firebase credentials and fails rather than publishing sample content if those secrets are missing; builds with a configured but unseeded Firestore database also fail with the missing document paths.

## Requirements

- Node.js 20 or newer
- npm
- A Firebase project with Firestore enabled (optional for local preview)

## Local development

```sh
npm install
npm run dev
```

To preview with live Firestore content, copy `.env.example` to `.env` and set:

- `FIREBASE_SERVICE_ACCOUNT_JSON`: the service-account JSON as a single-line value
- `FIREBASE_PROJECT_ID`: the Firebase project ID (optional when present in the JSON)

The account needs read access to the portfolio collections. For initial sample content, run `npm run seed` with the same Firebase credentials. The seed command overwrites the sample profile, experience, project, and skill documents; review the example data in `scripts/seed-firebase.mjs` before using it.

## Firestore content schema

| Path | Data |
| --- | --- |
| `settings/profile` | `name`, `role`, `location`, `summary`, `email`, `github`, `linkedin`, `website`, `availability`, `stats` |
| `experiences/{id}` | `company`, `role`, `location`, `period`, `summary`, `highlights`, `order` |
| `projects/{id}` | `slug`, `name`, `description`, `details` (Markdown), `technologies`, `githubUrl`, `liveUrl`, `featured`, `source`, `stars`, `order` |
| `skills/{id}` | `name`, `skills`, `order` |

All documents are read during static generation. Project `slug` values should be unique and URL-friendly. Markdown project details are sanitized before rendering.

## GitHub repository sync

The scheduled workflow reads public repositories for the repository owner, then writes them to Firestore as project documents with `source: "github"`. Add the following repository Actions secrets:

- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `FIREBASE_PROJECT_ID`

The workflow uses GitHub's built-in `GITHUB_TOKEN` to read public repositories. You can run it manually from the Actions tab. The sync removes stale documents created by previous GitHub syncs but leaves manually managed projects untouched.

## GitHub Pages deployment

1. Push this project to a GitHub repository and set the Pages source to **GitHub Actions**.
2. Add `FIREBASE_SERVICE_ACCOUNT_JSON` and `FIREBASE_PROJECT_ID` as repository Actions secrets.
3. Set `SITE_URL` in `.github/workflows/deploy.yml` if the site uses a custom domain or a different Pages host.
4. Push to `main` or run **Build and deploy portfolio** manually.

The Astro config derives the GitHub Pages project path from `GITHUB_REPOSITORY`, so project-site assets and links include the repository base path automatically. The `resume.pdf` asset is an illustrative sample; replace it with your own resume before deploying.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Astro development server |
| `npm run build` | Build the static site into `dist/` |
| `npm run preview` | Preview the built site locally |
| `npm run seed` | Write the included sample data to Firestore |
| `npm run sync:github` | Sync public repositories into Firestore |
| `npm run generate:resume` | Generate `public/resume.pdf`, `public/resume.md`, and `public/resume.json` from profile data and featured Firestore projects |

Resume generation requires the Firebase credentials used by the GitHub sync workflow (or a local `serviceAccountKey.json`) and reads the profile and experience files from `src/data/`.
