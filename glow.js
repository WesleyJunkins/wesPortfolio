document.addEventListener('DOMContentLoaded', () => {
    // Get all sections
    const sections = document.querySelectorAll('section');

    sections.forEach(section => {
        // Create glow element
        const glow = document.createElement('div');
        glow.className = 'glow';
        section.appendChild(glow);

        // Wrap section content
        const content = section.innerHTML;
        section.innerHTML = '';
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'section-content';
        contentWrapper.innerHTML = content;
        section.appendChild(contentWrapper);
        section.appendChild(glow);

        // Add mouse move event listener
        section.addEventListener('mousemove', (e) => {
            const rect = section.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Update glow position
            glow.style.left = `${x}px`;
            glow.style.top = `${y}px`;

            // Calculate rotation based on mouse position
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            // Normalize the position to a value between -1 and 1
            const normalizedX = (x - centerX) / centerX;
            const normalizedY = (y - centerY) / centerY;
            
            // Apply normalized rotation (multiply by 7 for a max rotation of 7 degrees)
            const rotateX = -normalizedY * 7;
            const rotateY = -normalizedX * 7;

            // Apply rotation
            section.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        });

        // Reset transform when mouse leaves
        section.addEventListener('mouseleave', () => {
            glow.style.opacity = '0';
            section.style.transform = 'rotateX(0) rotateY(0)';
        });

        // Show glow when mouse enters
        section.addEventListener('mouseenter', () => {
            glow.style.opacity = '1';
        });
    });
}); 