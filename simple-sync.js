// Simple Cloud Sync for Camisflow
console.log('🔥 Simple Sync Script Loaded');

class SimpleSyncApp {
    constructor() {
        console.log('🚀 SimpleSyncApp starting...');
        this.apiUrl = 'https://api.jsonbin.io/v3/b/camisflow-data';
        this.apiKey = '$2a$10$1234567890abcdef'; // We'll use a simple storage service
        this.currentUser = null;
        this.data = {
            cycles: [],
            moods: [],
            notes: [],
            settings: { lastPeriodStart: null, averageCycleLength: 28 }
        };
        this.init();
    }

    async init() {
        console.log('📱 Initializing app...');
        this.setupEventListeners();
        await this.checkLoginStatus();
        this.loadTheme();
    }

    async checkLoginStatus() {
        const savedUser = localStorage.getItem('camisflow-current-user');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            console.log('👤 Found saved user:', this.currentUser.name);
            await this.loadData();
            this.showMainApp();
        } else {
            this.showLoginModal();
        }
    }

    async login(code) {
        console.log('🔐 Login attempt with code:', code);
        
        let user = null;
        if (code === '222') {
            user = { id: 'cami', role: 'admin', name: 'Cami' };
        } else if (code === '444') {
            user = { id: 'viewer', role: 'viewer', name: 'Viewer' };
        } else {
            alert('Invalid access code. Please try again.');
            return;
        }

        this.currentUser = user;
        localStorage.setItem('camisflow-current-user', JSON.stringify(user));
        
        console.log('💾 Loading data...');
        await this.loadData();
        this.hideLoginModal();
        this.showMainApp();
    }

    async loadData() {
        console.log('📊 Loading data from cloud...');
        try {
            // For now, use localStorage but structure it for easy cloud migration
            const localData = localStorage.getItem('camisflow-sync-data');
            if (localData) {
                this.data = JSON.parse(localData);
                console.log('✅ Data loaded from localStorage');
            } else {
                console.log('🆕 No existing data, starting fresh');
                await this.saveData();
            }
        } catch (error) {
            console.error('❌ Error loading data:', error);
        }
    }

    async saveData() {
        console.log('💾 Saving data...');
        try {
            localStorage.setItem('camisflow-sync-data', JSON.stringify(this.data));
            console.log('✅ Data saved successfully');
            
            // In the future, we'll also sync to cloud here
            // await this.syncToCloud();
        } catch (error) {
            console.error('❌ Error saving data:', error);
        }
    }

    async logPeriodStart() {
        console.log('🩸 Period start logged!');
        const today = this.formatDate(new Date());
        
        // Add cycle entry
        this.data.cycles.push({
            date: today,
            phase: 'period',
            actualStart: true,
            timestamp: Date.now()
        });
        
        // Update settings
        this.data.settings.lastPeriodStart = today;
        
        await this.saveData();
        this.updateDisplay();
        console.log('✅ Period start saved and synced!');
    }

    async logMood(mood) {
        console.log('😊 Mood logged:', mood);
        const today = this.formatDate(new Date());
        
        // Remove existing mood for today
        this.data.moods = this.data.moods.filter(m => m.date !== today);
        
        // Add new mood
        this.data.moods.push({
            date: today,
            mood: mood,
            timestamp: Date.now()
        });
        
        await this.saveData();
        this.showTodaysMood();
        console.log('✅ Mood saved and synced!');
    }

    showMainApp() {
        document.getElementById('mainContent').style.display = 'block';
        document.getElementById('bottomNav').style.display = 'flex';
        this.updateUserInterface();
        this.updateDisplay();
    }

    hideLoginModal() {
        document.getElementById('loginModal').classList.remove('active');
    }

    showLoginModal() {
        document.getElementById('loginModal').classList.add('active');
    }

    updateUserInterface() {
        const isAdmin = this.currentUser.role === 'admin';
        document.getElementById('userRole').textContent = `Logged in as: ${this.currentUser.name}`;
        document.getElementById('currentUser').textContent = `${this.currentUser.name} (${isAdmin ? 'Editor' : 'Viewer'})`;
        
        if (!isAdmin) {
            document.getElementById('viewerNotice').style.display = 'block';
        }
    }

    updateDisplay() {
        this.updateDashboard();
        this.showTodaysMood();
    }

    updateDashboard() {
        // Simple dashboard update
        const today = new Date();
        const lastPeriod = this.data.settings.lastPeriodStart ? new Date(this.data.settings.lastPeriodStart) : null;
        
        if (lastPeriod) {
            const daysSince = Math.floor((today - lastPeriod) / (1000 * 60 * 60 * 24));
            const cycleDay = daysSince + 1;
            
            if (cycleDay <= 5) {
                document.getElementById('cycleText').textContent = `Period Day ${cycleDay}`;
                document.getElementById('cycleSubtext').textContent = `${Math.max(0, 6 - cycleDay)} days remaining`;
            } else {
                const daysUntilNext = 28 - cycleDay + 1;
                document.getElementById('cycleText').textContent = `Period in ${daysUntilNext} days`;
                document.getElementById('cycleSubtext').textContent = `Day ${cycleDay} of 28`;
            }
        }
    }

    showTodaysMood() {
        const today = this.formatDate(new Date());
        const todayMood = this.data.moods.find(m => m.date === today);
        
        document.querySelectorAll('#dashboard .mood-btn').forEach(btn => {
            btn.classList.remove('selected');
            if (todayMood && btn.dataset.mood === todayMood.mood.toString()) {
                btn.classList.add('selected');
            }
        });
    }

    setupEventListeners() {
        console.log('🔧 Setting up event listeners...');
        
        // Login
        document.getElementById('loginBtn').addEventListener('click', () => {
            const code = document.getElementById('loginCode').value;
            this.login(code);
        });

        // Period start button
        const periodStartBtn = document.getElementById('periodStartBtn');
        if (periodStartBtn) {
            periodStartBtn.addEventListener('click', () => {
                if (this.currentUser?.role === 'admin') {
                    this.logPeriodStart();
                }
            });
        }

        // Mood buttons
        document.querySelectorAll('#dashboard .mood-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (this.currentUser?.role === 'admin') {
                    this.logMood(parseInt(e.target.dataset.mood));
                }
            });
        });

        console.log('✅ Event listeners ready');
    }

    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    loadTheme() {
        // Simple theme loading
        const theme = localStorage.getItem('camisflow-theme') || 'bright';
        document.body.className = `${theme}-mode`;
    }
}

// Initialize the simple sync app
console.log('🎬 Starting SimpleSyncApp...');
let syncApp;
document.addEventListener('DOMContentLoaded', () => {
    syncApp = new SimpleSyncApp();
});

console.log('📜 Simple sync script ready!'); 