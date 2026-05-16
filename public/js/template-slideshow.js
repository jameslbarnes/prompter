// Template Slideshow Component
class TemplateSlideshow {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.templates = [];
        this.currentIndex = 0;
        this.isLoading = false;
        this.audioPlayers = new Map();
        this.autoplayInterval = null;
        this.autoplayDelay = 10000; // 10 seconds per slide
        
        this.init();
    }
    
    async init() {
        this.createSlideshow();
        await this.loadTemplates();
        this.attachEventListeners();
    }
    
    createSlideshow() {
        this.container.innerHTML = `
            <div class="template-slideshow">
                <div class="slideshow-container">
                    <div class="slideshow-loader">
                        <div class="loader-spinner"></div>
                        <p>Loading templates...</p>
                    </div>
                    <div class="slideshow-content" style="display: none;">
                        <div class="slideshow-track"></div>
                    </div>
                    <button class="slideshow-nav slideshow-prev" aria-label="Previous essay">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M15 18l-6-6 6-6"/>
                        </svg>
                    </button>
                    <button class="slideshow-nav slideshow-next" aria-label="Next essay">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 18l6-6-6-6"/>
                        </svg>
                    </button>
                </div>
                <div class="slideshow-indicators"></div>
            </div>
        `;
        
        this.loader = this.container.querySelector('.slideshow-loader');
        this.content = this.container.querySelector('.slideshow-content');
        this.track = this.container.querySelector('.slideshow-track');
        this.prevButton = this.container.querySelector('.slideshow-prev');
        this.nextButton = this.container.querySelector('.slideshow-next');
        this.indicators = this.container.querySelector('.slideshow-indicators');
    }
    
    async loadTemplates() {
        this.isLoading = true;
        
        try {
            const response = await fetch('/api/gallery/templates-with-audio?limit=5');
            const data = await response.json();
            
            if (data.templates && data.templates.length > 0) {
                this.templates = data.templates;
                this.renderSlides();
                this.createIndicators();
                this.preloadAudioMetadata();
                this.showSlide(0);
                this.startAutoplay();
                
                // Hide loader and show content
                this.loader.style.display = 'none';
                this.content.style.display = 'block';
            } else {
                this.showNoTemplatesMessage();
            }
        } catch (error) {
            console.error('Error loading templates:', error);
            this.showErrorMessage();
        } finally {
            this.isLoading = false;
        }
    }
    
    renderSlides() {
        if (!this.templates || this.templates.length === 0) {
            return;
        }
        
        this.track.innerHTML = this.templates.map((template, index) => `
            <div class="slideshow-slide" data-template-id="${template.id}" data-index="${index}">
                <div class="slide-content">
                    <div class="podcast-card">
                        ${template.latestPublishedInterview && template.latestPublishedInterview.originalReportId && template.latestPublishedInterview.audioUrl ? `
                            <div class="podcast-player">
                                <div class="episode-info">
                                    ${template.latestPublishedInterview.galleryTitle ? `
                                        <h4 class="episode-title">"${this.escapeHtml(template.latestPublishedInterview.galleryTitle)}"</h4>
                                    ` : ''}
                                    <p class="episode-description">${this.escapeHtml(template.description)}</p>
                                    <div class="personalized-attribution">
                                        <div class="person-avatar">
                                            <span>J</span>
                                        </div>
                                        <span class="attribution-text">Personalized from interview with James Barnes</span>
                                    </div>
                                </div>
                                
                                <div class="audio-controls" data-report-id="${template.latestPublishedInterview.originalReportId}">
                                    <button class="audio-play-button" data-template-index="${index}" aria-label="Play audio">
                                        <svg class="play-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                        </svg>
                                        <svg class="pause-icon" style="display: none;" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                            <rect x="6" y="4" width="4" height="16"></rect>
                                            <rect x="14" y="4" width="4" height="16"></rect>
                                        </svg>
                                    </button>
                                    <div class="audio-timeline">
                                        <div class="progress-bar">
                                            <div class="progress-fill"></div>
                                        </div>
                                        <div class="time-display">
                                            <span class="audio-time">0:00 / ${this.formatDuration(template.latestPublishedInterview.duration)}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="episode-stats">
                                    <span class="stat">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                        </svg>
                                        ${template.latestPublishedInterview.plays || 0} plays
                                    </span>
                                    <span class="stat-separator">•</span>
                                    <span class="stat">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="9" cy="7" r="4"></circle>
                                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                        </svg>
                                        ${Math.floor(Math.random() * 50) + 30} personalized
                                    </span>
                                </div>
                            </div>
                        ` : ''}
                        
                        <div class="podcast-cta">
                            <div class="cta-intro">
                                <p>
                                    Personalize yours with 
                                    <span class="say-inline-logo">
                                        <img src="saylogo.png" alt="Say" width="20" height="20">
                                        <span>Say</span>
                                    </span>
                                </p>
                            </div>
                            <form class="podcast-form" data-template-index="${index}">
                                <div class="form-inline">
                                    <input type="text" name="userName" placeholder="Your first name" required>
                                    <input type="email" name="userEmail" placeholder="your@email.com" required>
                                    <button type="submit" class="join-button">
                                        <span>Begin Interview</span>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M5 12h14m-7-7l7 7-7 7"></path>
                                        </svg>
                                    </button>
                                </div>
                                <p class="form-note">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline-block; vertical-align: -2px; margin-right: 4px; opacity: 0.7;">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                                    </svg>
                                    Talk for 5 minutes → receive personalized wisdom in your inbox
                                </p>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    createIndicators() {
        this.indicators.innerHTML = this.templates.map((_, index) => `
            <button class="slideshow-indicator" data-index="${index}" aria-label="Go to essay ${index + 1}"></button>
        `).join('');
    }
    
    showSlide(index) {
        // Pause any playing audio
        this.pauseAllAudio();
        
        // Update index
        this.currentIndex = index;
        
        // Move track
        const slideWidth = 100; // percentage
        this.track.style.transform = `translateX(-${index * slideWidth}%)`;
        
        // Update indicators
        this.updateIndicators();
        
        // Update navigation buttons
        this.updateNavigationButtons();
    }
    
    updateIndicators() {
        const indicators = this.indicators.querySelectorAll('.slideshow-indicator');
        indicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', index === this.currentIndex);
        });
    }
    
    updateNavigationButtons() {
        this.prevButton.disabled = this.currentIndex === 0;
        this.nextButton.disabled = this.currentIndex === this.templates.length - 1;
    }
    
    preloadAudioMetadata() {
        // Preload audio metadata for all templates to get accurate durations
        this.templates.forEach((template, index) => {
            if (template.latestPublishedInterview?.audioUrl) {
                const audio = new Audio();
                audio.preload = 'metadata';
                
                audio.addEventListener('loadedmetadata', () => {
                    // Update the duration display
                    const durationElement = this.container.querySelector(
                        `.slideshow-slide[data-index="${index}"] .audio-time`
                    );
                    if (durationElement && audio.duration) {
                        const currentTime = durationElement.textContent.split(' / ')[0];
                        durationElement.textContent = `${currentTime} / ${this.formatTime(audio.duration)}`;
                    }
                });
                
                audio.src = template.latestPublishedInterview.audioUrl;
            }
        });
    }
    
    nextSlide() {
        if (this.currentIndex < this.templates.length - 1) {
            this.showSlide(this.currentIndex + 1);
        } else {
            // Loop back to first slide
            this.showSlide(0);
        }
    }
    
    prevSlide() {
        if (this.currentIndex > 0) {
            this.showSlide(this.currentIndex - 1);
        }
    }
    
    startAutoplay() {
        this.stopAutoplay();
        this.autoplayInterval = setInterval(() => {
            this.nextSlide();
        }, this.autoplayDelay);
    }
    
    stopAutoplay() {
        if (this.autoplayInterval) {
            clearInterval(this.autoplayInterval);
            this.autoplayInterval = null;
        }
    }
    
    attachEventListeners() {
        // Navigation buttons
        this.prevButton.addEventListener('click', () => {
            this.prevSlide();
            this.stopAutoplay(); // Stop autoplay on manual navigation
        });
        
        this.nextButton.addEventListener('click', () => {
            this.nextSlide();
            this.stopAutoplay(); // Stop autoplay on manual navigation
        });
        
        // Indicators
        this.indicators.addEventListener('click', (e) => {
            if (e.target.classList.contains('slideshow-indicator')) {
                const index = parseInt(e.target.dataset.index);
                this.showSlide(index);
                this.stopAutoplay(); // Stop autoplay on manual navigation
            }
        });
        
        // Form submissions
        this.track.addEventListener('submit', async (e) => {
            if (e.target.classList.contains('podcast-form')) {
                e.preventDefault();
                await this.handleFormSubmit(e.target);
            }
        });
        
        // Audio player controls
        this.track.addEventListener('click', async (e) => {
            const playButton = e.target.closest('.audio-play-button');
            if (playButton) {
                const templateIndex = parseInt(playButton.dataset.templateIndex);
                await this.toggleAudio(templateIndex);
            }
        });
        
        // Pause autoplay on hover
        this.container.addEventListener('mouseenter', () => this.stopAutoplay());
        this.container.addEventListener('mouseleave', () => this.startAutoplay());
        
        // Handle visibility change (pause when tab is not visible)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopAutoplay();
                this.pauseAllAudio();
            } else {
                this.startAutoplay();
            }
        });
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            // Only handle if slideshow is visible and no input is focused
            if (!this.container.offsetParent) return;
            if (document.activeElement.tagName === 'INPUT') return;
            
            switch(e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    this.prevSlide();
                    this.resetAutoplay();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.nextSlide();
                    this.resetAutoplay();
                    break;
                case ' ':
                    // Spacebar to play/pause current audio
                    const currentButton = this.container.querySelector(`.slideshow-slide[data-index="${this.currentIndex}"] .audio-play-button`);
                    if (currentButton) {
                        e.preventDefault();
                        currentButton.click();
                    }
                    break;
            }
        });
    }
    
    async handleFormSubmit(form) {
        const templateIndex = parseInt(form.dataset.templateIndex);
        const template = this.templates[templateIndex];
        const button = form.querySelector('.join-button');
        const formData = new FormData(form);
        
        // Show loading state
        button.classList.add('loading');
        button.disabled = true;
        
        try {
            const name = formData.get('userName');
            const email = formData.get('userEmail');
            
            // Validate inputs
            if (!name || !email) {
                throw new Error('Please fill in all fields');
            }
            
            if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                throw new Error('Please enter a valid email address');
            }
            
            // Open interview in new window
            const url = `/i/?interview=${template.originalInterviewId || template.id}&adminEmail=${encodeURIComponent(email)}&adminName=${encodeURIComponent(name)}`;
            window.open(url, '_blank');
            
            // Reset form
            form.reset();
            
            // Track event
            if (typeof trackEvent === 'function') {
                trackEvent('Template Slideshow', 'Interview Started', template.title);
            }
            
        } catch (error) {
            alert(error.message || 'Something went wrong. Please try again.');
        } finally {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }
    
    async toggleAudio(templateIndex) {
        const template = this.templates[templateIndex];
        const reportId = template.latestPublishedInterview?.originalReportId;
        const audioUrl = template.latestPublishedInterview?.audioUrl;
        
        if (!reportId || !audioUrl) return;
        
        const container = this.track.querySelector(`.audio-controls[data-report-id="${reportId}"]`);
        const playButton = container.querySelector('.audio-play-button');
        const playIcon = playButton.querySelector('.play-icon');
        const pauseIcon = playButton.querySelector('.pause-icon');
        
        // Check if audio is already playing
        let audio = this.audioPlayers.get(reportId);
        
        if (audio && !audio.paused) {
            // Pause audio
            audio.pause();
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
            return;
        }
        
        // Pause all other audio
        this.pauseAllAudio();
        
        // If audio doesn't exist, create it
        if (!audio) {
            try {
                // Show loading state
                playButton.disabled = true;
                
                // Create audio element with the URL we already have
                audio = new Audio(audioUrl);
                this.audioPlayers.set(reportId, audio);
                
                // Set up audio event listeners
                this.setupAudioListeners(audio, container, reportId);
                
            } catch (error) {
                console.error('Error loading audio:', error);
                alert('Unable to load audio. Please try again.');
                playButton.disabled = false;
                return;
            } finally {
                playButton.disabled = false;
            }
        }
        
        // Play audio
        audio.play().catch(error => {
            console.error('Error playing audio:', error);
            alert('Unable to play audio. The file may be unavailable.');
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        });
        
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
        
        // Stop autoplay while audio is playing
        this.stopAutoplay();
    }
    
    
    setupAudioListeners(audio, container, reportId) {
        const progressBar = container.querySelector('.progress-fill');
        const timeDisplay = container.querySelector('.audio-time');
        const playButton = container.querySelector('.audio-play-button');
        const playIcon = playButton.querySelector('.play-icon');
        const pauseIcon = playButton.querySelector('.pause-icon');
        
        // Update progress
        audio.addEventListener('timeupdate', () => {
            const progress = (audio.currentTime / audio.duration) * 100;
            progressBar.style.width = `${progress}%`;
            
            const currentTime = this.formatTime(audio.currentTime);
            const duration = this.formatTime(audio.duration);
            timeDisplay.textContent = `${currentTime} / ${duration}`;
        });
        
        // Handle ended
        audio.addEventListener('ended', () => {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
            progressBar.style.width = '0%';
            
            // Resume autoplay
            this.startAutoplay();
        });
        
        // Handle pause
        audio.addEventListener('pause', () => {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        });
        
        // Handle play
        audio.addEventListener('play', () => {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        });
    }
    
    pauseAllAudio() {
        this.audioPlayers.forEach((audio, reportId) => {
            if (!audio.paused) {
                audio.pause();
            }
        });
    }
    
    formatDuration(seconds) {
        if (!seconds || seconds === 0) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    
    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        return this.formatDuration(seconds);
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    getCategoryBadge(category) {
        const categoryConfig = {
            'philosophy': { icon: '🧠', label: 'Philosophy' },
            'business': { icon: '💼', label: 'Business' },
            'self-help': { icon: '🌟', label: 'Self-Help' },
            'productivity': { icon: '⚡', label: 'Productivity' },
            'psychology': { icon: '🧩', label: 'Psychology' },
            'creativity': { icon: '🎨', label: 'Creativity' },
            'leadership': { icon: '👔', label: 'Leadership' },
            'technology': { icon: '💻', label: 'Technology' },
            'education': { icon: '📚', label: 'Education' },
            'health': { icon: '🏥', label: 'Health & Wellness' },
            'personal': { icon: '👤', label: 'Personal Growth' }
        };
        
        const config = categoryConfig[category] || { icon: '📄', label: category || 'Essay' };
        
        return `
            <div class="template-category">
                <span>${config.icon}</span>
                <span>${config.label}</span>
            </div>
        `;
    }
    
    showNoTemplatesMessage() {
        this.content.innerHTML = `
            <div class="slideshow-message">
                <p>No published interview templates available yet.</p>
                <p>Check back soon!</p>
            </div>
        `;
        this.loader.style.display = 'none';
        this.content.style.display = 'block';
    }
    
    showErrorMessage() {
        this.content.innerHTML = `
            <div class="slideshow-message error">
                <p>Unable to load templates.</p>
                <p>Please try again later.</p>
            </div>
        `;
        this.loader.style.display = 'none';
        this.content.style.display = 'block';
    }
    
    destroy() {
        // Clean up
        this.stopAutoplay();
        this.pauseAllAudio();
        this.audioPlayers.clear();
        this.container.innerHTML = '';
    }
}

// Initialize slideshow when DOM is ready
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TemplateSlideshow;
}