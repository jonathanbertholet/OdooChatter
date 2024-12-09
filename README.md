# Odoo Chatter Manager

A Chrome extension that enhances the Odoo user experience with customizable chatter positioning, debug mode management, and improved support page styling.

## Features

### Chatter Management
- **Hide/Show Chatter**: Toggle the visibility of the chatter panel with a convenient side button
- **Chatter Position**: Choose between side-by-side or vertical layout
- **Default State**: Set your preferred default chatter visibility

### Debug Mode
- **Persistent Debug Mode**: Automatically maintain debug mode across page navigation
- **Quick Toggle**: Enable/disable debug mode without manual URL modification

### Support Page Enhancements
- **Stylish Interface**: Modern styling for the Odoo support pages
- **Table of Contents**: Auto-generated navigation for easy section access
- **Improved Navigation**: Enhanced navbar with integrated impersonation controls
- **Scroll Spy**: Active section highlighting while scrolling

### Quick Access
- **Settings Shortcut**: Direct access to Odoo settings page
- **Persistent Settings**: Your preferences are saved across sessions

## Installation

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Usage

### Basic Configuration
1. Click the extension icon in your Chrome toolbar
2. Toggle the desired settings:
   - Hide chatter
   - Display chatter below
   - Always debug mode
   - Stylish Support

### Chatter Controls
- Use the side toggle button to show/hide the chatter panel
- Change chatter position in extension popup settings

### Support Page Features
The enhanced support page styling is available only for Odoo employees and includes:
- Automatic table of contents generation
- Smooth scrolling navigation
- Improved layout and readability
- Integrated impersonation controls in the navbar

## Files Structure

- `manifest.json`: Extension configuration
- `popup.html`: Extension popup interface
- `popup.js`: Popup functionality
- `content.js`: Main extension logic
- `styles.css`: General extension styles
- `support.css`: Support page enhancement styles

## Requirements

- Google Chrome browser
- Access to Odoo pages (some features are specific to Odoo employees)

## Contributing

Feel free to submit issues and enhancement requests!

## License

[Your chosen license] 