RAGBOARD: Full Project Overview

Overview

RAGBOARD is a collaborative, AI-powered workspace for research and content ideation. Users create boards—essentially infinite canvases—containing frames and cards of various media types (video, images, text, audio). An integrated AI assistant, content-library integrations, and collaboration features help users research trends, collect references, annotate content, and generate copy.

The goal of this project is to rebuild the system from scratch. This document outlines the key modules, data structures, and API interactions needed to build a functional clone of the original platform under the new name, RAGBOARD.

⸻

Core Features and User Flows

1. Authentication & User Management
	•	Sign-up/Sign-in – Support OAuth (e.g., Google) and email/password. Present a login form like the original. Store user data: name, email, hashed password, OAuth provider, and roles.
	•	Session Handling – Use secure cookies or JWTs. Middleware will protect routes.
	•	User Profile & Subscription – Track subscription tiers, usage credits (e.g., tokens for AI), and referral codes. Include upgrade/referral UI in the board header.
	•	Invite & Share – Users can share boards via email or link with view, comment, or edit permissions. Store board-user permission mappings.

2. Board Management
	•	Dashboard/List View – Display all boards with actions (star, duplicate, rename, archive, etc.). Organize under “All boards”, “Starred”, “Templates”, “Shared with me”, “Archived”, or user folders.
	•	New Board & Templates – Create a blank board or use a template. Store layout and metadata.
	•	Board Settings – Edit board name, thumbnail, folder, and collaborators. Boards have unique slugs (e.g., /boards/proud-wave-0aZ9l).
	•	Board Preview Thumbnail – Capture and store a snapshot of the board canvas for the dashboard.

3. Infinite Canvas & Frames
	•	Canvas Engine – Infinite pan/zoom canvas using Konva.js or HTML5 Canvas/SVG. Supports draggable/resizable frames, connectors, and free-floating cards.
	•	Frames – Rectangular containers with titles and optional background color. Resizable, movable, and contain cards.
	•	Connectors – Arrows/lines between frames with stored start/end IDs and control points.
	•	Scene Navigation – Small thumbnail previews for navigation. Clicking scrolls to that scene.
	•	Undo/Redo & Zoom – Add history and zoom controls (“+”, “–”, “fit to screen”).

4. Card Types

Each card has a distinct data model and rendering:
	•	Video Card – Embed YouTube or MP4 videos with preview, title, transcript, notes, and star button.
	•	Image Card – Show web, uploaded, or library images. Support cropping and captions.
	•	Text Card – Rich-text editor with headings, bullets, links, highlights.
	•	Document Card – Embed PDFs/docs with previews or icons. Allow download.
	•	Audio/Voice Card – Record audio, transcribe it, and display waveform + transcript.
	•	Annotation/Callout Card – Sticky notes/callouts (e.g., “Angelo Dodaro” note) for attribution/context.

5. Tool Palette / Sidebar

Left-hand vertical toolbar with quick actions:
	•	AI Chat (magic wand) – Opens chat panel for creative prompts, research help. Returns text/image/video. Link to help.
	•	Comment/Feedback – Sidebar for discussions at board/frame/card level.
	•	Video/Audio Capture – Record/upload content into cards.
	•	Ads Library (“f Ads” icon) – Fetch trending ads via external APIs (e.g., Meta Ads Library) and import them.
	•	Microphone/Voice Note – Record and transcribe audio notes.
	•	File Upload – Upload files and convert to cards.
	•	Text Tool (“T” icons) – Add sticky notes or rich-text cards.
	•	Globe/Explore – Find trending content across platforms (TikTok, Instagram, etc.).
	•	Share/Integration – Manage links, embed boards, export to other platforms.
	•	New Board/Scene – Quick-create new boards or scenes.

6. AI-Assisted Features
	•	Chat-Based Ideation – Use LLMs like OpenAI to generate ideas based on board context.
	•	Content Summarization – Summarize videos or articles into text cards.
	•	Trend Analysis – Get trending topics from APIs, insert as cards.
	•	Ad Copy Generator – Generate multiple ad variants based on product/tone.

7. Collaboration & Comments
	•	Real-Time Collaboration – WebSockets (e.g., Socket.io) for live updates. Show avatars/cursors.
	•	Comments & Mentions – Comment threads on board/frame/card with @mentions.
	•	Notifications – Alerts for shares, comments, mentions.

8. Export & Integration
	•	Export Boards – Export as PDF, images, JSON. Export button in header.
	•	API Access – REST/GraphQL API for boards/cards/AI. Include API keys in “APIs” section.
	•	Referrals & Affiliate Program – Track referrals and payouts. Show referral banner (e.g., “Refer & Earn $70”).

9. Admin & Billing
	•	Usage Tracking – Track AI usage by user. Enforce limits by subscription tier.
	•	Billing & Plans – Use Stripe (or similar) for payments. Upgrade UI for plan selection.
	•	Admin Dashboard – Admin controls for users, templates, boards, usage.

⸻

Technical Architecture

Front-End
	•	Framework – React (TypeScript), using Redux or Context API. Infinite canvas with Konva.js/Fabric.js.
	•	Routing – React Router for paths like /boards, /templates, /folders/:id, etc.
	•	UI Components – Reusable components (BoardCard, Frame, Toolbar, etc.) via Material-UI or custom styling.
	•	Real-Time Collab – Use Socket.io or WebRTC. Show cursors, resolve conflicts.

Back-End
	•	Server – Node.js with Express or Fastify. REST/GraphQL for auth, boards, AI, admin.
	•	Database – PostgreSQL or MongoDB. Models: Users, Boards, Frames, Cards, Comments, Tokens, Subscriptions, ReferralCodes. Assets in AWS S3 or Google Cloud.
	•	Authentication – OAuth (Google) + email/password via Passport.js. Bcrypt + JWT for security.
	•	AI Services – Microservice for AI requests. Integrate transcription (e.g., Whisper).
	•	External Integrations – APIs for Meta Ads, YouTube, TikTok, Stripe, etc.
	•	WebSockets – Real-time board sync via Socket.io.

DevOps & Hosting
	•	Deployment – Dockerized app on AWS/GCP/Azure. Use Kubernetes or managed hosting.
	•	Static Assets – Serve via CDN. Use compression and cache headers.
	•	Security – HTTPS, rate limiting, XSS/CSRF protection, input validation.
	•	Monitoring – Logstash/Datadog for error monitoring. Alerts for system/billing issues.

⸻

Milestones & Deliverables
	1.	Foundation – Auth, board CRUD, dashboard UI, folder organization.
	2.	Canvas & Frames – Infinite canvas, zoom, undo/redo, frame/card placement.
	3.	Card Types – Add video, image, and text card functionality.
	4.	Tool Palette – Build toolbar and import tools (ads library, explore).
	5.	AI Services – Add chat, copy generation, summarization, transcription.
	6.	Collaboration – Enable real-time editing and comments.
	7.	Export & API – Export options and public API access.
	8.	Billing & Referrals – Implement payments, usage tracking, referrals.
	9.	Testing & QA – Unit/e2e tests, user testing, accessibility audits.
	10.	Deployment & Docs – Production deployment, dev docs, onboarding.

⸻

Conclusion

Rebuilding RAGBOARD entails developing a real-time, AI-assisted, collaborative canvas environment. With the above detailed system architecture and feature list, a capable developer team or AI code agent can systematically implement each module to deliver a fully functional platform mirroring the original vision under its new name, RAGBOARD.

⸻

RAGBOARD Toolbar: Feature Recreation Plan

1. AI Chat (Magic-Wand Icon)
	•	Function: Chat overlay (keyboard shortcut “C”) for AI prompts, summarizing, ad copy, research help.
	•	Build Plan: Floating button → Chat panel → OpenAI integration → Contextual responses → Streaming → Persist chat per board.

2. Comments/Feedback (Speech-Bubble Icon)
	•	Function: Comments panel with thread support and @mentions.
	•	Build Plan: Sidebar UI → Comment input → Real-time updates → Notifications → Moderation.

3. Video/Media Import (Camera Icon)
	•	Function: Search/import trending video content or user uploads.
	•	Build Plan: API integration (TikTok, YouTube) → Thumbnail list → Drag into board → Personal library.

4. Ads Library (f Ads Icon)
	•	Function: Fetch trending ads from Meta Ads Library.
	•	Build Plan: Search UI → Meta API → Drag into board → Store creative + metadata → Favorites/history.

5. Voice Recorder (Microphone Icon)
	•	Function: Record voice notes with transcription.
	•	Build Plan: MediaRecorder API → Audio card + waveform → Transcribe via Whisper → Cloud storage.

6. File/Document Upload (Paper Icon)
	•	Function: Upload PDFs, images, files.
	•	Build Plan: File picker → Preview thumbnails → Insert as cards → Store in cloud → Virus scan.

7. Text Tool (“T” Icons)
	•	Function: Add sticky notes or rich-text cards.
	•	Build Plan: One-line notes or full editor (Slate.js/Draft.js) → AI-assisted writing → Markdown support.

8. Shapes/Annotations (Stylized “A” Icon)
	•	Function: Draw arrows, callouts, highlights.
	•	Build Plan: SVG shapes → Callout editing → Layer control → Style settings → Metadata stored.

9. Explore/Trending (Globe Icon)
	•	Function: Find and import trending content from various sources.
	•	Build Plan: APIs for trending data → Search filters → Card import → AI-assisted topic suggestions.

10. Integrations/Share (Connected-Nodes Icon)
	•	Function: Share settings, embed, third-party integrations.
	•	Build Plan: Permissions UI → Embed code → OAuth for Notion/Slack/etc. → Activity logs.

11. New Board / Duplicate (Paper + Icon)
	•	Function: Create new or duplicate board.
	•	Build Plan: Menu for new board or template → Copy frames/cards → Optional from-selection duplication.


--------------------------------------------

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },y
])
```
