# Modular JavaScript Structure

This directory contains the refactored, modular version of the interview application JavaScript code. The original monolithic `script.js` file has been broken down into focused, maintainable modules.

## File Structure

```
js/
├── README.md                 # This file
├── main.js                   # Main entry point
├── config.js                 # Configuration and constants
├── state.js                  # Global state management
├── dom.js                    # DOM element references
├── utils.js                  # Utility functions
├── audio/
│   ├── recorder.js          # Audio recording functionality
│   └── streaming.js         # Audio streaming (MSE)
├── socket/
│   └── events.js            # Socket.io event handlers
├── ui/
│   ├── controls.js          # UI controls and updates
│   ├── fileUpload.js        # File upload functionality
│   ├── thinking.js          # Thinking trace UI
│   ├── theme.js             # Theme switching
│   └── keyboard.js          # Keyboard event handlers
└── interview/
    └── flow.js              # Interview flow logic
```

## Module Descriptions

### Core Modules

- **`main.js`** - The main entry point that initializes the application and coordinates all modules
- **`config.js`** - Contains all configuration constants, feature flags, and settings
- **`state.js`** - Centralized state management for the entire application
- **`dom.js`** - References to all DOM elements used throughout the application
- **`utils.js`** - Common utility functions used across modules

### Feature Modules

- **`audio/recorder.js`** - Handles microphone access, recording, and audio blob management
- **`audio/streaming.js`** - Manages Media Source Extensions for audio streaming
- **`socket/events.js`** - All Socket.io event listeners and connection management
- **`ui/controls.js`** - UI state management, button controls, and progress updates
- **`ui/fileUpload.js`** - File upload, drag & drop, and resume text handling
- **`ui/thinking.js`** - AI thinking process visualization and streaming
- **`ui/theme.js`** - Dark/light theme switching functionality
- **`ui/keyboard.js`** - Keyboard shortcuts and event handling
- **`interview/flow.js`** - Interview start logic and flow management

## Benefits of Modular Structure

### 1. **Maintainability**
- Each module has a single responsibility
- Easier to locate and fix bugs
- Changes to one feature don't affect others

### 2. **Readability**
- Smaller, focused files are easier to understand
- Clear separation of concerns
- Better code organization

### 3. **Reusability**
- Modules can be imported and used in different contexts
- Utility functions are centralized
- Common patterns are abstracted

### 4. **Testing**
- Individual modules can be unit tested
- Dependencies are explicit through imports
- Easier to mock dependencies

### 5. **Performance**
- Only load modules that are needed
- Better tree-shaking with bundlers
- Clearer dependency graph

## Usage

### Basic Usage

Include the main module in your HTML:

```html
<script type="module" src="js/main.js"></script>
```

### Importing Specific Modules

```javascript
// Import specific functions
import { showError, formatTime } from './utils.js';
import { state } from './state.js';
import { elements } from './dom.js';

// Use the imported functions
showError('Something went wrong');
console.log(formatTime(300)); // "5:00"
```

### Extending Functionality

To add new features:

1. Create a new module file
2. Export the functions you want to make available
3. Import and use in `main.js` or other modules

```javascript
// js/features/newFeature.js
import { state } from '../state.js';
import { elements } from '../dom.js';

export function newFeatureFunction() {
    // Your code here
}
```

## Implementation Status

✅ **All Modules Completed and Integrated:**
- `config.js` - Configuration and constants
- `state.js` - Global state management (with AppState compatibility)
- `dom.js` - DOM element references
- `utils.js` - Utility functions
- `audio/recorder.js` - Audio recording functionality
- `audio/streaming.js` - Audio streaming (MSE)
- `ui/controls.js` - UI controls and updates
- `ui/fileUpload.js` - File upload and drag & drop
- `ui/thinking.js` - AI thinking visualization
- `ui/theme.js` - Theme switching
- `ui/keyboard.js` - Keyboard shortcuts
- `socket/events.js` - Socket.io event handlers
- `interview/flow.js` - Interview flow management
- `main.js` - Main entry point

✅ **HTML Files Updated:**
- `index.html` - Updated to use modular structure via `js/main.js`
- `report.html` - Uses original `state.js` for AppState compatibility
- `admin.html` - Uses original `state.js` for AppState compatibility

📁 **File Structure Note:**
- `/js/` folder contains modular files for the interview interface
- Root `state.js` is kept for admin.html and report.html compatibility

## Migration from Original Script

The original `script.js` file contained approximately 3,400 lines of code. This has been broken down into:

- **Main entry point**: ~387 lines
- **Configuration**: ~65 lines  
- **State management**: ~130 lines (interview interface only)
- **DOM references**: ~90 lines
- **Utilities**: ~260 lines
- **Audio recording**: ~470 lines
- **Audio streaming**: ~150 lines
- **Socket events**: ~400 lines
- **UI controls**: ~270 lines
- **File upload**: ~200 lines
- **Thinking UI**: ~180 lines
- **Theme management**: ~80 lines
- **Keyboard handling**: ~120 lines
- **Interview flow**: ~200 lines

This represents a significant improvement in code organization and maintainability, with **complete backward compatibility** for existing HTML files.

## Development Guidelines

### Adding New Features

1. Determine which module the feature belongs to
2. If it doesn't fit existing modules, create a new one
3. Keep modules focused on a single responsibility
4. Use clear, descriptive function names
5. Document complex logic with comments

### State Management

- All global state should go through the `state.js` module
- Use the provided helper functions to update state
- Avoid direct state mutations outside of state.js

### Error Handling

- Use the centralized error handling in `utils.js`
- Provide meaningful error messages
- Log errors for debugging

### Performance Considerations

- Import only what you need
- Avoid circular dependencies
- Use async/await for asynchronous operations
- Clean up event listeners and timers

## Browser Compatibility

This modular structure uses ES6 modules, which are supported in:

- Chrome 61+
- Firefox 60+
- Safari 10.1+
- Edge 16+

For older browsers, you may need to use a bundler like Webpack or Rollup.

## Future Improvements

Potential enhancements to consider:

1. **TypeScript**: Add type safety with TypeScript
2. **Testing**: Add unit tests for each module
3. **Bundling**: Use a bundler for production optimization
4. **Documentation**: Add JSDoc comments for better IDE support
5. **Linting**: Add ESLint for code quality enforcement 