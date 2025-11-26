# Apple Music Project

## Overview
This is a Node.js web application starter project for an Apple Music-related service. The project was imported from GitHub as a minimal skeleton and has been set up to run in the Replit environment.

**Current State:** Basic Express.js web server running with a simple welcome page.

## Recent Changes
- **2024-11-26**: Initial Replit setup
  - Installed Node.js 20 and Express.js
  - Created basic Express web server on port 5000
  - Configured workflow for automatic server startup
  - Added deployment configuration for autoscale
  - Added .gitignore for Node.js projects

## Project Architecture

### Tech Stack
- **Runtime:** Node.js 20
- **Framework:** Express.js 5.1.0
- **Port:** 5000 (bound to 0.0.0.0 for Replit compatibility)

### Project Structure
```
.
├── index.js           # Main Express server file
├── package.json       # Node.js dependencies and scripts
├── .gitignore        # Git ignore rules for Node.js
├── .replit           # Replit configuration
└── README.md         # Project readme
```

### Server Configuration
- **Host:** 0.0.0.0 (required for Replit's proxy system)
- **Port:** 5000 (frontend/webview port)
- **Routes:**
  - `GET /` - Welcome page with UI
  - `GET /api/status` - API health check endpoint

## Development

### Running Locally
The server starts automatically via the "Start application" workflow. To manually start:
```bash
npm start
```

### Deployment
The project is configured for autoscale deployment, which is ideal for stateless web applications. The deployment will automatically use the `npm start` command.

## Future Enhancements
This is a starter template. Potential features to add:
- Apple Music API integration
- User authentication
- Music playback functionality
- Playlist management
- Search functionality
