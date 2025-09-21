#!/bin/bash

# Generate favicons from an input image using Inkscape
# Usage: ./scripts/generate-favicons.sh <input-image>

if [ $# -eq 0 ]; then
    echo "Usage: $0 <input-image>"
    echo "Example: $0 logo.svg"
    exit 1
fi

INPUT_IMAGE="$1"

if [ ! -f "$INPUT_IMAGE" ]; then
    echo "Error: Input image '$INPUT_IMAGE' not found"
    exit 1
fi

# Check if inkscape is installed
if ! command -v inkscape &> /dev/null; then
    echo "Error: Inkscape is not installed. Please install it first:"
    echo "  Ubuntu/Debian: sudo apt install inkscape"
    echo "  macOS: brew install inkscape"
    exit 1
fi

echo "Generating favicons from $INPUT_IMAGE..."

# Create public/icons directory if it doesn't exist
mkdir -p public/icons

# Generate different sizes
echo "Generating favicon.ico (16x16, 32x32, 48x48)..."
inkscape "$INPUT_IMAGE" --export-type=png --export-width=16 --export-filename=public/icons/favicon-16x16.png
inkscape "$INPUT_IMAGE" --export-type=png --export-width=32 --export-filename=public/icons/favicon-32x32.png
inkscape "$INPUT_IMAGE" --export-type=png --export-width=48 --export-filename=public/icons/favicon-48x48.png

# Convert to ICO format (requires ImageMagick convert)
if command -v convert &> /dev/null; then
    convert public/icons/favicon-16x16.png public/icons/favicon-32x32.png public/icons/favicon-48x48.png public/icons/favicon.ico
    echo "Generated favicon.ico"
    # Clean up temporary PNG files
    rm public/icons/favicon-16x16.png public/icons/favicon-32x32.png public/icons/favicon-48x48.png
else
    echo "Warning: ImageMagick not found. Generated PNG files instead of ICO."
    echo "Install ImageMagick to generate favicon.ico: sudo apt install imagemagick"
fi

echo "Generating Apple Touch Icon (180x180)..."
inkscape "$INPUT_IMAGE" --export-type=png --export-width=180 --export-filename=public/icons/apple-touch-icon.png

echo "Generating high-resolution favicon (512x512)..."
inkscape "$INPUT_IMAGE" --export-type=png --export-width=512 --export-filename=public/icons/favicon-512x512.png

echo "Favicon generation complete!"
echo "Generated files:"
echo "  - public/icons/favicon.ico (or PNG files if ImageMagick not available)"
echo "  - public/icons/apple-touch-icon.png"
echo "  - public/icons/favicon-512x512.png"