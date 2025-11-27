# Overview

This is a video downloading service that provides an API for downloading videos from Dailymotion. The application is built with Node.js and Express, and uses external tools like ffmpeg for video processing. It supports multiple video quality options (1080p down to 240p) and output formats (MP4, MP3). The service can be deployed on multiple platforms including Railway, Replit, and Vercel.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Backend Architecture

**Technology Stack**: Node.js with Express 5.x framework

**Problem**: Need a simple HTTP server to handle video download requests and streaming  
**Solution**: Express.js provides a lightweight, flexible web server with robust routing capabilities  
**Rationale**: Express is well-suited for building REST APIs and handling file streams efficiently

## Video Processing Pipeline

**Problem**: Need to download and optionally convert videos from Dailymotion in various formats and qualities  
**Solution**: Two-tier approach:
1. Primary: Use ffmpeg for video processing and format conversion when available
2. Fallback: Direct video download when ffmpeg is not installed

**Implementation Details**:
- Quality options: 1080p, 720p, 480p, 380p, 360p (default), 240p, auto
- Format options: MP4 (default), MP3
- Temporary storage: `/tmp/videos` directory for processing intermediate files
- Startup check for ffmpeg availability to determine processing capabilities

**Rationale**: ffmpeg provides professional-grade video processing, while fallback ensures service availability in constrained environments

## URL Processing

**Problem**: Handle various URL formats and encoding schemes from user input  
**Solution**: URL extraction and normalization logic that:
- Handles encoded URLs (including double-encoding)
- Decodes URLs iteratively until fully resolved
- Extracts video IDs from various Dailymotion URL formats

**Rationale**: Users may submit URLs in different formats or encoded states; robust parsing ensures reliability

## Multi-Platform Deployment

**Problem**: Need to run on different hosting platforms with varying configurations  
**Solution**: Dynamic base URL detection that checks for:
- Railway: `RAILWAY_PUBLIC_DOMAIN` environment variable
- Replit: `REPLIT_DEV_DOMAIN` or `REPLIT_DOMAINS` environment variables
- Fallback: Request headers

**Protocol Selection**: Automatically determines HTTPS vs HTTP based on:
- Request protocol
- Domain detection (Replit/Railway domains default to HTTPS)

**Rationale**: Ensures the application generates correct URLs for API responses regardless of deployment platform

## Static File Serving

**Component**: HTML interface (`web.html`) appears to be from Dailymotion's frontend
**Purpose**: Likely used as a reference or template for the video download interface

## API Response Fields

### Search Endpoint (`/recherche`)
Returns video duration information:
- `duree_secondes`: Duration in seconds
- `duree_formatee`: Human-readable duration (e.g., "3:45" or "1:15:30")

### Info Endpoint (`/info`)
Returns comprehensive video metadata:
- `duree_secondes`: Duration in seconds
- `duree_formatee`: Human-readable duration
- `qualites_disponibles`: Array of available quality strings (maintains backward compatibility)
- `qualites_details`: Array with detailed quality info including:
  - `taille_estimee_mp4`: Estimated MP4 size based on typical video bitrates
  - `taille_estimee_mp3`: Estimated MP3 size based on 192kbps audio encoding

### Size Estimation
- MP4 sizes are estimated using typical bitrates per quality level (1080p: 4500kbps, 720p: 2500kbps, etc.)
- MP3 sizes are calculated using the actual 192kbps encoding rate
- Note: These are estimates; actual sizes may vary based on video content and encoding

# External Dependencies

## NPM Packages

1. **express** (v5.1.0) - Web server framework
2. **axios** (v1.13.2) - HTTP client for making requests to external APIs/services
3. **cheerio** (v1.1.2) - HTML parsing library (jQuery-like syntax for server-side)

**Purpose**: Likely used to scrape or parse Dailymotion video pages to extract download URLs and metadata

## System Dependencies

1. **ffmpeg** - Video processing tool
   - Optional but recommended
   - Checked at startup via `execSync('ffmpeg -version')`
   - Used for video conversion and audio extraction
   - Application degrades gracefully when unavailable

## External Services

1. **Dailymotion** - Video platform
   - Source of videos being downloaded
   - API endpoints referenced in web.html:
     - GraphQL API: `https://graphql.api.dailymotion.com`
     - OAuth: `https://graphql.api.dailymotion.com/oauth/token`
   - CDN: `static1.dmcdn.net`

## Deployment Platforms

Configured for deployment on:
1. **Vercel** - Configuration in `vercel.json` using `@vercel/node` builder
2. **Railway** - Environment variable detection
3. **Replit** - Environment variable detection