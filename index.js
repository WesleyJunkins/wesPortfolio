// Research Page Custom JavaScript - Interactive Effects

document.addEventListener('DOMContentLoaded', () => {
    // Initialize all effects
    initParticleBackground();
    initSectionEffects();
    initButtonEffects();
    initScrollEffects();
    initTextAnimations();
    initSectionSwitching();
    initGalleryButtons();
    renderProjectImages();
    initStickyNav();
    initDateTime();
});

// Section Switching Functionality
function initSectionSwitching() {
    // Add event listeners to nav buttons and dropdown items
    const navButtons = document.querySelectorAll('.nav-buttons .button');
    const dropdownItems = document.querySelectorAll('.dropdown-item');
    
    // Show objective section by default
    showSection('objective');
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(event) {
        const dropdowns = document.querySelectorAll('.dropdown');
        dropdowns.forEach(dropdown => {
            if (!dropdown.contains(event.target)) {
                dropdown.classList.remove('active');
            }
        });
    });
    
    // Close mobile submenus when clicking outside
    document.addEventListener('click', function(event) {
        const submenus = document.querySelectorAll('.mobile-submenu');
        submenus.forEach(submenu => {
            if (!submenu.contains(event.target) && !event.target.closest('.mobile-nav-buttons')) {
                // Animate closing
                if (submenu.classList.contains('active')) {
                    submenu.style.maxHeight = submenu.scrollHeight + 'px';
                    setTimeout(() => {
                        submenu.style.maxHeight = '0';
                        submenu.style.opacity = '0';
                        submenu.style.transform = 'translateY(-10px)';
                    }, 10);
                    setTimeout(() => {
                        submenu.classList.remove('active');
                        submenu.style.maxHeight = '';
                        submenu.style.opacity = '';
                        submenu.style.transform = '';
                    }, 300);
                }
            }
        });
    });
    
    // Reposition dropdowns on window resize
    window.addEventListener('resize', function() {
        const activeDropdowns = document.querySelectorAll('.dropdown.active');
        activeDropdowns.forEach(dropdown => {
            const dropdownMenu = dropdown.querySelector('.dropdown-menu');
            if (dropdownMenu) {
                positionDropdown(dropdownMenu);
            }
        });
    });
    
    // Add event listeners to submenu items
    document.querySelectorAll('.submenu-item').forEach(item => {
        item.addEventListener('click', function() {
            // Close all mobile submenus when a submenu item is clicked
            document.querySelectorAll('.mobile-submenu').forEach(submenu => {
                if (submenu.classList.contains('active')) {
                    // Animate closing
                    submenu.style.maxHeight = submenu.scrollHeight + 'px';
                    setTimeout(() => {
                        submenu.style.maxHeight = '0';
                        submenu.style.opacity = '0';
                        submenu.style.transform = 'translateY(-10px)';
                    }, 10);
                    setTimeout(() => {
                        submenu.classList.remove('active');
                        submenu.style.maxHeight = '';
                        submenu.style.opacity = '';
                        submenu.style.transform = '';
                    }, 300);
                }
            });
            
            // Close mobile menu
            if (window.innerWidth <= 768) {
                toggleMobileMenu();
            }
        });
    });
    
    // Add event listeners to regular nav buttons (About, My Links)
    document.querySelectorAll('.mobile-nav-buttons .button').forEach(button => {
        button.addEventListener('click', function() {
            // Check if this button is not a dropdown toggle
            const isDropdownToggle = this.getAttribute('onclick') && 
                                   this.getAttribute('onclick').includes('toggleMobileSubmenu');
            
            if (!isDropdownToggle) {
                // Close all mobile submenus
                document.querySelectorAll('.mobile-submenu').forEach(submenu => {
                    if (submenu.classList.contains('active')) {
                        // Animate closing
                        submenu.style.maxHeight = submenu.scrollHeight + 'px';
                        setTimeout(() => {
                            submenu.style.maxHeight = '0';
                            submenu.style.opacity = '0';
                            submenu.style.transform = 'translateY(-10px)';
                        }, 10);
                        setTimeout(() => {
                            submenu.classList.remove('active');
                            submenu.style.maxHeight = '';
                            submenu.style.opacity = '';
                            submenu.style.transform = '';
                        }, 300);
                    }
                });
                
                // Close mobile menu
                if (window.innerWidth <= 768) {
                    toggleMobileMenu();
                }
            }
        });
    });
}

function showSection(sectionName) {
    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
        section.style.display = 'none';
    });
    // Show the selected section
    const targetSection = document.querySelector(`#${sectionName}`);
    if (targetSection) {
        targetSection.style.display = 'block';
        targetSection.style.opacity = '0';
        targetSection.style.transform = 'translateY(20px)';
        setTimeout(() => {
            targetSection.style.transition = 'all 0.3s ease';
            targetSection.style.opacity = '1';
            targetSection.style.transform = 'translateY(0)';
        }, 100);
        // Animate bubbles morphing up (genie effect)
        const bubbles = targetSection.querySelectorAll('.bubble');
        bubbles.forEach((bubble, i) => {
            bubble.classList.remove('morphing-up');
            // Reset to invisible and squished
            bubble.style.opacity = '0';
            bubble.style.transform = 'scaleY(0.2) scaleX(1.1)';
            bubble.style.borderRadius = '60px';
            setTimeout(() => {
                bubble.classList.add('morphing-up');
                // Clean up after animation
                setTimeout(() => {
                    bubble.classList.remove('morphing-up');
                    bubble.style.opacity = '';
                    bubble.style.transform = '';
                    bubble.style.borderRadius = '';
                }, 600);
            }, 150 + i * 80);
        });
    }

    
    setTimeout(() => {
        renderProjectImages();
        initGalleryButtons();
    }, 200);
}

function showAllSections() {
    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
        section.style.display = 'block';
    });
}

// Lava Strands Background Effect
function initParticleBackground() {
    const canvas = document.getElementById('bg');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Lava strand class
    class LavaStrand {
        constructor(flowPattern = 1) {
            this.points = [];
            this.hue = Math.random() * 360;
            this.hueSpeed = (Math.random() - 0.5) * 1;
            this.opacity = 0.525;
            this.width = 350;
            this.speed = (Math.random() - 0.5) * 1.5;
            this.noiseOffset = Math.random() * 1000;
            this.flowPattern = flowPattern; // Different flow patterns
            
            // Random flow physics
            this.lastFlowEvent = 0;
            this.flowEventDuration = 0;
            this.flowEventIntensity = 0;
            
            // Particle system
            this.particles = [];
            this.particleSpawnTimer = 0;
            
            // Initialize strand points
            this.generateStrand();
        }
        
        generateStrand() {
            this.points = [];
            const centerX = canvas.width * 0.5; // Center horizontally
            const topY = -100; // Just above screen
            const bottomY = canvas.height + 100; // Just below screen
            const segments = 12; // Much shorter strands
            
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                
                // Different flow patterns with more slack
                let x, y;
                if (this.flowPattern === 1) {
                    // First strand pattern
                    x = centerX + Math.sin(t * Math.PI * 4 + this.noiseOffset) * 200;
                    y = bottomY + t * (topY - bottomY) + Math.sin(t * Math.PI * 8) * 100;
                } else {
                    // Second strand pattern - different flow
                    x = centerX + Math.sin(t * Math.PI * 5 + this.noiseOffset * 1.5) * 180;
                    y = bottomY + t * (topY - bottomY) + Math.sin(t * Math.PI * 10 + this.noiseOffset) * 120;
                }
                
                const width = this.width * (1 - t * 0.2);
                this.points.push({ x, y, width, opacity: 1 });
            }
        }
        
        update() {
            this.hue += this.hueSpeed;
            this.noiseOffset += 0.01;
            
            // Spawn particles from strand
            this.particleSpawnTimer++;
            if (this.particleSpawnTimer > 10) { // Spawn every 10 frames
                this.spawnParticles();
                this.particleSpawnTimer = 0;
            }
            
            // Update particles
            this.particles.forEach((particle, index) => {
                particle.x += particle.vx;
                particle.y += particle.vy;
                particle.life -= 0.02;
                particle.size *= 0.98;
                
                // Remove dead particles
                if (particle.life <= 0) {
                    this.particles.splice(index, 1);
                }
            });
            
            // Random flow physics events
            const currentTime = Date.now();
            if (currentTime - this.lastFlowEvent > 20000) { // 20 seconds minimum
                if (Math.random() < 0.01) { // 1% chance per frame after 20 seconds
                    this.flowEventIntensity = Math.random() * 3 + 2; // 2-5 intensity
                    this.flowEventDuration = Math.random() * 3000 + 2000; // 2-5 seconds
                    this.lastFlowEvent = currentTime;
                }
            }
            
            // Apply flow event physics
            if (this.flowEventIntensity > 0) {
                this.flowEventIntensity -= 0.02; // Decay over time
                if (this.flowEventIntensity <= 0) {
                    this.flowEventIntensity = 0;
                }
            }
            
            // Update strand points - only animate the middle section
            this.points.forEach((point, index) => {
                const t = index / this.points.length;
                
                // Only animate points in the middle section (not the endpoints)
                if (t > 0.1 && t < 0.9) {
                    const baseMovement = Math.sin(this.noiseOffset + index * 0.5) * 0.2;
                    const flowEventMovement = Math.sin(this.noiseOffset * 2 + index * 0.8) * this.flowEventIntensity * 0.5;
                    
                    point.x += baseMovement + flowEventMovement;
                    
                    // Lock midpoint to horizontal center line
                    if (Math.abs(t - 0.5) < 0.1) { // Midpoint area (40-60% of strand)
                        point.y = canvas.height * 0.5; // Lock to center horizontal line
                    } else {
                        point.y += this.speed * 0.3 + (this.flowEventIntensity * 0.2); // Enhanced movement during flow events
                    }
                }
                
                point.width = this.width * (1 - t * 0.3) * (0.8 + Math.sin(this.noiseOffset + index) * 0.2);
                
                // Keep strand visible with endpoints just outside screen
                const edgeDistance = 150;
                if (point.y > canvas.height + edgeDistance || point.y < -edgeDistance ||
                    point.x > canvas.width + edgeDistance || point.x < -edgeDistance) {
                    point.opacity = 0.2; // Keep faint for endpoints
                } else {
                    // Simple opacity calculation
                    const distFromTop = Math.max(0, edgeDistance - point.y);
                    const distFromBottom = Math.max(0, point.y - (canvas.height - edgeDistance));
                    const distFromLeft = Math.max(0, edgeDistance - point.x);
                    const distFromRight = Math.max(0, point.x - (canvas.width - edgeDistance));
                    
                    const minDist = Math.min(distFromTop, distFromBottom, distFromLeft, distFromRight);
                    point.opacity = Math.max(0.5, minDist / edgeDistance);
                }
            });
        
        // No regeneration - strand stays fixed
        }
        
        spawnParticles() {
            // Spawn particles from random points along the strand
            const spawnPoints = this.points.filter((_, index) => {
                const t = index / this.points.length;
                return t > 0.2 && t < 0.8; // Spawn from middle section
            });
            
            if (spawnPoints.length > 0) {
                const spawnPoint = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
                
                // Create 1-3 particles per spawn
                const particleCount = Math.floor(Math.random() * 3) + 1;
                for (let i = 0; i < particleCount; i++) {
                    this.particles.push({
                        x: spawnPoint.x + (Math.random() - 0.5) * 20,
                        y: spawnPoint.y + (Math.random() - 0.5) * 20,
                        vx: (Math.random() - 0.5) * 2,
                        vy: (Math.random() - 0.5) * 2,
                        size: Math.random() * 8 + 4,
                        life: 1.0,
                        hue: this.hue + Math.random() * 30 - 15
                    });
                }
            }
        }
        
        draw() {
            ctx.save();
            
            // Draw the strand as a flowing path with opacity
            ctx.beginPath();
            let firstVisiblePoint = null;
            
            for (let i = 0; i < this.points.length; i++) {
                const point = this.points[i];
                
                if (point.opacity > 0.01) {
                    if (firstVisiblePoint === null) {
                        ctx.moveTo(point.x, point.y);
                        firstVisiblePoint = point;
                    } else {
                        const prevPoint = this.points[i - 1];
                        
                        // Create smooth curve
                        const cp1x = prevPoint.x + (point.x - prevPoint.x) * 0.5;
                        const cp1y = prevPoint.y;
                        const cp2x = point.x - (point.x - prevPoint.x) * 0.5;
                        const cp2y = point.y;
                        
                        ctx.quadraticCurveTo(cp1x, cp1y, point.x, point.y);
                    }
                }
            }
            
            // Create gradient for the strand with darker colors
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            const color1 = `hsla(${this.hue}, 80%, 25%, ${this.opacity})`;
            const color2 = `hsla(${this.hue + 30}, 90%, 20%, ${this.opacity * 0.8})`;
            const color3 = `hsla(${this.hue + 60}, 70%, 15%, ${this.opacity * 0.6})`;
            
            gradient.addColorStop(0, color1);
            gradient.addColorStop(0.5, color2);
            gradient.addColorStop(1, color3);
            
            // Create the strand with varying width and opacity
            ctx.lineWidth = this.width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = gradient;
            ctx.globalAlpha = this.opacity;
            
            // Add heavy blur effect
            ctx.filter = 'blur(20px)';
            ctx.stroke();
            ctx.filter = 'none';
            
            // Add glow effect
            ctx.shadowColor = `hsl(${this.hue}, 80%, 25%)`;
            ctx.shadowBlur = 40;
            ctx.stroke();
            ctx.shadowBlur = 0;
            
            // Draw inner core with heavy blur
            ctx.lineWidth = this.width * 0.8;
            ctx.strokeStyle = `hsla(${this.hue}, 90%, 35%, ${this.opacity * 0.9})`;
            ctx.filter = 'blur(12px)';
            ctx.stroke();
            ctx.filter = 'none';
            
            ctx.restore();
            
            // Draw particles
            this.particles.forEach(particle => {
                ctx.save();
                ctx.globalAlpha = particle.life * this.opacity * 0.6;
                ctx.fillStyle = `hsla(${particle.hue}, 80%, 60%, ${particle.life})`;
                ctx.shadowColor = `hsl(${particle.hue}, 80%, 60%)`;
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });
        }
    }
    
    // Create lava strands
    const strands = [];
    const strandCount = 2;
    
    for (let i = 0; i < strandCount; i++) {
        strands.push(new LavaStrand(i + 1));
    }
    
    // Animation loop
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw dark background for lava lamp effect
        const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        bgGradient.addColorStop(0, 'rgba(20, 20, 40, 0.8)');
        bgGradient.addColorStop(0.5, 'rgba(30, 30, 60, 0.6)');
        bgGradient.addColorStop(1, 'rgba(40, 40, 80, 0.8)');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw strands (second strand first so it appears behind)
        strands.slice().reverse().forEach(strand => {
            strand.update();
            strand.draw();
        });
        
        // No connections needed for single strand
        
        requestAnimationFrame(animate);
    }
    
    animate();
}

// Section Interactive Effects
function initSectionEffects() {
    const sections = document.querySelectorAll('section');
    
    sections.forEach((section, index) => {
        // Add staggered entrance animation
        section.style.opacity = '0';
        section.style.transform = 'translateY(50px)';
        
        setTimeout(() => {
            section.style.transition = 'all 0.8s ease';
            section.style.opacity = '1';
            section.style.transform = 'translateY(0)';
        }, index * 200);
        
        // Removed click ripple effect
    });
}

// Button Interactive Effects
function initButtonEffects() {
    const buttons = document.querySelectorAll('.button');
    
    buttons.forEach(button => {
        // Add magnetic effect
        button.addEventListener('mousemove', (e) => {
            const rect = button.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            
            button.style.transform = `translate(${x * 0.1}px, ${y * 0.1}px)`;
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translate(0, 0)';
        });
        
        // Add click effect
        button.addEventListener('click', () => {
            button.style.transform = 'scale(0.95)';
            setTimeout(() => {
                button.style.transform = 'scale(1)';
            }, 150);
        });
    });
}

// Scroll Effects
function initScrollEffects() {
    const sections = document.querySelectorAll('section');
    
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    sections.forEach(section => {
        observer.observe(section);
    });
}

// Text Animation Effects
function initTextAnimations() {
    const titles = document.querySelectorAll('h1, h2, .nav-title');
    
    titles.forEach(title => {
        const text = title.textContent;
        title.innerHTML = '';
        
        text.split('').forEach((char, index) => {
            const span = document.createElement('span');
            span.textContent = char === ' ' ? '\u00A0' : char;
            span.style.opacity = '0';
            span.style.transform = 'translateY(20px)';
            span.style.transition = `all 0.3s ease ${index * 0.05}s`;
            title.appendChild(span);
            
            setTimeout(() => {
                span.style.opacity = '1';
                span.style.transform = 'translateY(0)';
            }, 500 + index * 50);
        });
    });
}

// Add floating elements
function addFloatingElements() {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'];
    
    for (let i = 0; i < 5; i++) {
        const element = document.createElement('div');
        element.style.position = 'fixed';
        element.style.width = '20px';
        element.style.height = '20px';
        element.style.borderRadius = '50%';
        element.style.background = colors[i];
        element.style.opacity = '0.3';
        element.style.pointerEvents = 'none';
        element.style.zIndex = '-1';
        element.style.left = Math.random() * window.innerWidth + 'px';
        element.style.top = Math.random() * window.innerHeight + 'px';
        element.style.animation = `float ${3 + Math.random() * 4}s ease-in-out infinite`;
        element.style.animationDelay = Math.random() * 2 + 's';
        
        document.body.appendChild(element);
    }
}

// Add floating animation to CSS
const floatingStyle = document.createElement('style');
floatingStyle.textContent = `
    @keyframes float {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        50% { transform: translateY(-20px) rotate(180deg); }
    }
`;
document.head.appendChild(floatingStyle);

// Initialize floating elements
setTimeout(addFloatingElements, 1000);

// Add smooth scrolling
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Add keyboard navigation
document.addEventListener('keydown', (e) => {
    const sections = document.querySelectorAll('section');
    const currentSection = Array.from(sections).findIndex(section => {
        const rect = section.getBoundingClientRect();
        return rect.top <= window.innerHeight / 2 && rect.bottom >= window.innerHeight / 2;
    });
    
    if (e.key === 'ArrowDown' && currentSection < sections.length - 1) {
        sections[currentSection + 1].scrollIntoView({ behavior: 'smooth' });
    } else if (e.key === 'ArrowUp' && currentSection > 0) {
        sections[currentSection - 1].scrollIntoView({ behavior: 'smooth' });
    }
});

// --- Gallery Modal Logic ---
function createGalleryModal(images, startIndex = 0) {
    // Remove any existing modal
    const existing = document.querySelector('.gallery-modal-overlay');
    if (existing) existing.remove();

    let currentIndex = startIndex;

    // Modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'gallery-modal-overlay gallery-modal-opening';
    overlay.tabIndex = 0;

    // Modal content
    const modal = document.createElement('div');
    modal.className = 'gallery-modal';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'gallery-modal-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = closeModal;
    modal.appendChild(closeBtn);

    // Image element
    const img = document.createElement('img');
    img.className = 'gallery-modal-image';
    img.src = images[currentIndex];
    img.alt = `Gallery Image ${currentIndex+1}`;
    modal.appendChild(img);

    // Navigation
    const nav = document.createElement('div');
    nav.className = 'gallery-modal-nav';
    const prevBtn = document.createElement('button');
    prevBtn.className = 'gallery-modal-btn';
    prevBtn.innerHTML = '&#9664;';
    const nextBtn = document.createElement('button');
    nextBtn.className = 'gallery-modal-btn';
    nextBtn.innerHTML = '&#9654;';
    nav.appendChild(prevBtn);
    nav.appendChild(nextBtn);
    modal.appendChild(nav);

    // Show image
    function showImage(idx) {
        img.src = images[idx];
        img.alt = `Gallery Image ${idx+1}`;
    }

    // Add event listeners to navigation buttons
    prevBtn.addEventListener('click', () => {
        currentIndex = (currentIndex - 1 + images.length) % images.length;
        showImage(currentIndex);
    });
    nextBtn.addEventListener('click', () => {
        currentIndex = (currentIndex + 1) % images.length;
        showImage(currentIndex);
    });

    // Add event listeners to close button
    closeBtn.addEventListener('click', closeModal);

    // Add event listeners to overlay
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeModal();
    });
    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // Append modal to body
    document.body.appendChild(overlay);
    overlay.appendChild(modal);

    // Open modal
    overlay.classList.add('gallery-modal-open');
}

function closeModal() {
    const overlay = document.querySelector('.gallery-modal-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function renderProjectImages() {
    document.querySelectorAll('.project-bubble').forEach(bubble => {
        // Remove any existing image container
        const oldImg = bubble.querySelector('.project-image-container');
        if (oldImg) oldImg.remove();

        // Get images from data-images attribute (as JSON array)
        const imagesAttr = bubble.getAttribute('data-images');
        if (!imagesAttr) return;
        let images;
        try {
            images = JSON.parse(imagesAttr);
        } catch {
            return;
        }
        if (!Array.isArray(images) || images.length === 0) return;

        // Create image container
        const container = document.createElement('div');
        container.className = 'project-image-container';
        container.setAttribute('data-images', images.join(','));

        // Main image
        const img = document.createElement('img');
        img.src = images[0];
        img.alt = 'Main Image';
        container.appendChild(img);

        // Only show "View all images" button if there are multiple images
        if (images.length > 1) {
            const btn = document.createElement('button');
            btn.className = 'view-images-btn';
            btn.textContent = 'View all Images';
            container.appendChild(btn);
        }

        // Insert at the end of the bubble
        bubble.appendChild(container);
    });
}

function initGalleryButtons() {
    document.querySelectorAll('.view-images-btn').forEach(btn => {
        btn.onclick = function(e) {
            e.stopPropagation();
            const container = btn.closest('.project-image-container');
            let images = [];
            if (container && container.dataset.images) {
                images = container.dataset.images
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);
            } else {
                // fallback: just use the main image
                const img = container.querySelector('img');
                if (img) images = [img.src];
            }
            if (images.length > 0) {
                createGalleryModal(images, 0);
            }
        };
    });
}

// Top navigation bar effects
function initStickyNav() {
    // Add any additional effects for the top nav bar if needed
    const navButtons = document.querySelectorAll('.nav-buttons .button');
    const dropdownItems = document.querySelectorAll('.dropdown-item');
    
    navButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Close mobile menu when a button is clicked
            if (window.innerWidth <= 768) {
                toggleMobileMenu();
            }
        });
    });
    
    dropdownItems.forEach(item => {
        item.addEventListener('click', function() {
            // Close all dropdowns when a dropdown item is clicked
            document.querySelectorAll('.dropdown').forEach(dropdown => {
                dropdown.classList.remove('active');
            });
            
            // Close mobile menu when a dropdown item is clicked
            if (window.innerWidth <= 768) {
                toggleMobileMenu();
            }
        });
    });
}

// Dropdown toggle function
function toggleDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    const dropdownContainer = dropdown.parentElement;
    const allDropdowns = document.querySelectorAll('.dropdown');
    
    // If this dropdown is already active, close it
    if (dropdownContainer.classList.contains('active')) {
        dropdownContainer.classList.remove('active');
        return;
    }
    
    // Close all other dropdowns
    allDropdowns.forEach(d => {
        d.classList.remove('active');
    });
    
    // Open the clicked dropdown
    dropdownContainer.classList.add('active');
    
    // Position the dropdown to stay on screen
    positionDropdown(dropdown);
}

// Function to position dropdown menus to stay on screen
function positionDropdown(dropdownMenu) {
    const rect = dropdownMenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const dropdownWidth = rect.width;
    const leftPosition = rect.left;
    const rightPosition = rect.right;
    
    // Reset any previous positioning
    dropdownMenu.style.left = '';
    dropdownMenu.style.right = '';
    
    // Check if dropdown would overflow on the right
    if (rightPosition + dropdownWidth > viewportWidth) {
        // Position from the right edge
        dropdownMenu.style.left = 'auto';
        dropdownMenu.style.right = '0';
    }
    
    // Check if dropdown would overflow on the left
    if (leftPosition < 0) {
        // Position from the left edge
        dropdownMenu.style.left = '0';
        dropdownMenu.style.right = 'auto';
    }
}

// Mobile menu toggle function
function toggleMobileMenu() {
    const navButtons = document.querySelector('.nav-buttons');
    const mobileNavButtons = document.querySelector('.mobile-nav-buttons');
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    
    // Toggle between desktop and mobile nav
    if (window.innerWidth <= 768) {
        mobileNavButtons.classList.toggle('active');
    } else {
        navButtons.classList.toggle('active');
    }
    menuToggle.classList.toggle('active');
}

// Mobile submenu toggle function
function toggleMobileSubmenu(submenuId) {
    const submenu = document.getElementById(submenuId);
    const allSubmenus = document.querySelectorAll('.mobile-submenu');
    
    // Close all other submenus
    allSubmenus.forEach(menu => {
        if (menu.id !== submenuId) {
            menu.classList.remove('active');
        }
    });
    
    // Toggle the clicked submenu with animation
    if (submenu.classList.contains('active')) {
        // Animate closing
        submenu.style.maxHeight = submenu.scrollHeight + 'px';
        setTimeout(() => {
            submenu.style.maxHeight = '0';
            submenu.style.opacity = '0';
            submenu.style.transform = 'translateY(-10px)';
        }, 10);
        setTimeout(() => {
            submenu.classList.remove('active');
            submenu.style.maxHeight = '';
            submenu.style.opacity = '';
            submenu.style.transform = '';
        }, 300);
    } else {
        // Animate opening
        submenu.classList.add('active');
        submenu.style.maxHeight = '0';
        submenu.style.opacity = '0';
        submenu.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            submenu.style.maxHeight = submenu.scrollHeight + 'px';
            submenu.style.opacity = '1';
            submenu.style.transform = 'translateY(0)';
        }, 10);
        setTimeout(() => {
            submenu.style.maxHeight = '';
            submenu.style.opacity = '';
            submenu.style.transform = '';
        }, 300);
    }
}

// DateTime functionality
function initDateTime() {
    function updateDateTime() {
        const now = new Date();
        const options = {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        };
        const dateTimeString = now.toLocaleDateString('en-US', options);
        const datetimeElement = document.getElementById('current-datetime');
        if (datetimeElement) {
            datetimeElement.textContent = dateTimeString;
        }
    }
    
    // Update immediately and then every second
    updateDateTime();
    setInterval(updateDateTime, 1000);
}