// Run this script in a browser console or Node with canvas to generate icons
// Or simply use the SVG as a temporary icon

const sizes = [16, 48, 128];

function generateIcons() {
    sizes.forEach(size => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Background circle
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(size/2, size/2, size/2 - 1, 0, Math.PI * 2);
        ctx.fill();
        
        // Highlighter pen icon (simplified)
        ctx.strokeStyle = '#333';
        ctx.lineWidth = Math.max(1, size / 16);
        ctx.beginPath();
        ctx.moveTo(size * 0.3, size * 0.7);
        ctx.lineTo(size * 0.7, size * 0.3);
        ctx.stroke();
        
        // Highlight mark
        ctx.fillStyle = '#FFEB3B';
        ctx.globalAlpha = 0.5;
        ctx.fillRect(size * 0.25, size * 0.55, size * 0.5, size * 0.15);
        
        const link = document.createElement('a');
        link.download = `icon${size}.png`;
        link.href = canvas.toDataURL();
        link.click();
    });
}

console.log('Open this in a browser console to generate icons, or use the SVG instead.');
