# Fonts Directory

This directory contains font files used by the application for video generation.

## Included Fonts

- **Roboto-Regular.ttf** - Used for text overlays in generated videos (b-roll prompts)
  - Source: Google Fonts (https://fonts.google.com/specimen/Roboto)
  - License: Apache License 2.0

## Purpose

These font files are bundled with the application to ensure consistent text rendering across all deployment environments (local, staging, production). This avoids issues with missing system fonts in containerized environments like Railway.

## Usage

The video generation code in `server/utils/video.js` uses these fonts for the FFmpeg drawtext filter when adding text overlays to videos.