// Camisflow - Period & Ovulation Tracker with Convex

// Initialize Convex client
const convex = new window.ConvexReactClient("https://beloved-seahorse-729.convex.cloud");

class CamisflowApp {
    constructor() {
        this.currentUser = null;
        this.currentUserId = null;
        this.currentMonth = new Date();
        this.selectedDate = null;
        this.cycleLogs = [];
        this.moodLogs = [];
        this.notes = [];
        this.averageCycleLength = 28;
        this.lastPeriodStart = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkLoginStatus();
        this.loadTheme();
    }

    // ===== CONVEX DATA METHODS =====
    async loadUserData() {
        if (!this.currentUserId) return;
        
        try {
            // Load all user data in parallel
            const [cycleLogs, moodLogs, notes] = await Promise.all([
                convex.query("cycle:getCycleLogs", { userId: this.currentUserId }),
                convex.query("moods:getMoodLogs", { userId: this.currentUserId }),
                convex.query("notes:getNotes", { userId: this.currentUserId })
            ]);
            
            this.cycleLogs = cycleLogs || [];
            this.moodLogs = moodLogs || [];
            this.notes = notes || [];
            
            // Get user info for cycle settings
            const user = await convex.query("users:getUserByAccessCode", { 
                accessCode: this.currentUser.accessCode 
            });
            
            if (user) {
                this.averageCycleLength = user.averageCycleLength || 28;
                this.lastPeriodStart = user.lastPeriodStart;
            }
            
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    async saveUserCycleInfo() {
        if (!this.currentUserId) return;
        
        try {
            await convex.mutation("users:updateUser", {
                userId: this.currentUserId,
                averageCycleLength: this.averageCycleLength,
                lastPeriodStart: this.lastPeriodStart
            });
        } catch (error) {
            console.error('Error saving user cycle info:', error);
        }
    }

    // ===== AUTHENTICATION =====
    async checkLoginStatus() {
        const savedUser = localStorage.getItem('camisflow-current-user');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.currentUserId = this.currentUser._id;
            await this.loadUserData();
            this.showMainApp();
        } else {
            this.showLoginModal();
        }
    }

    async login(code) {
        try {
            // First, try to find the user in Convex
            let user = await convex.query("users:getUserByAccessCode", { accessCode: code });
            
            if (!user) {
                // Create user if doesn't exist
                let userData = {};
                if (code === '222') {
                    userData = { name: 'Cami', role: 'admin', accessCode: code };
                } else if (code === '444') {
                    userData = { name: 'Viewer', role: 'viewer', accessCode: code };
                } else {
                    this.showError('Invalid access code. Please try again.');
                    return;
                }
                
                const userId = await convex.mutation("users:createUser", userData);
                user = { _id: userId, ...userData };
            }

            this.currentUser = user;
            this.currentUserId = user._id;
            localStorage.setItem('camisflow-current-user', JSON.stringify(user));
            
            // Load user's data
            await this.loadUserData();
            
            this.hideLoginModal();
            this.showMainApp();
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Login failed. Please try again.');
        }
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('camisflow-current-user');
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('bottomNav').style.display = 'none';
        this.showLoginModal();
    }

    showLoginModal() {
        document.getElementById('loginModal').classList.add('active');
    }

    hideLoginModal() {
        document.getElementById('loginModal').classList.remove('active');
    }

    showMainApp() {
        document.getElementById('mainContent').style.display = 'block';
        document.getElementById('bottomNav').style.display = 'flex';
        this.updateUserInterface();
        this.loadAppData();
    }

    updateUserInterface() {
        const isAdmin = this.currentUser.role === 'admin';
        const authBtn = document.getElementById('authBtn');
        const userRole = document.getElementById('userRole');
        const viewerNotice = document.getElementById('viewerNotice');
        const currentUser = document.getElementById('currentUser');
        const adminSection = document.getElementById('adminSection');

        // Update auth button
        authBtn.textContent = 'Logout';
        authBtn.onclick = () => this.logout();

        // Update user info
        userRole.textContent = `Logged in as: ${this.currentUser.name}`;
        currentUser.textContent = `${this.currentUser.name} (${isAdmin ? 'Editor' : 'Viewer'})`;

        // Show/hide viewer notice
        if (!isAdmin) {
            viewerNotice.style.display = 'block';
            document.getElementById('moodDisabled').style.display = 'flex';
        } else {
            viewerNotice.style.display = 'none';
            document.getElementById('moodDisabled').style.display = 'none';
        }

        // Show/hide admin sections
        adminSection.style.display = isAdmin ? 'block' : 'none';

        // Disable/enable interactive elements
        this.setInteractiveMode(isAdmin);
    }

    setInteractiveMode(enabled) {
        const interactiveElements = [
            ...document.querySelectorAll('.mood-btn'),
            document.getElementById('addNoteBtn'),
            document.getElementById('saveNote'),
            document.getElementById('saveDayData')
        ];

        interactiveElements.forEach(el => {
            if (el) {
                el.disabled = !enabled;
                if (!enabled) {
                    el.style.opacity = '0.5';
                    el.style.cursor = 'not-allowed';
                }
            }
        });
    }

    showError(message) {
        alert(message); // In production, use a proper toast/notification system
    }

    // ===== DATA ACCESS HELPERS =====
    getCycleLogForDate(dateStr) {
        return this.cycleLogs.find(log => log.date === dateStr);
    }

    getMoodForDate(dateStr) {
        const moodLog = this.moodLogs.find(log => log.date === dateStr);
        return moodLog ? moodLog.mood : null;
    }

    getNoteForDate(dateStr) {
        const note = this.notes.find(note => note.date === dateStr);
        return note ? note.content : null;
    }

    async loadAppData() {
        this.updateDashboard();
        this.renderMiniCalendar();
        this.renderCalendar();
        this.updateInsights();
        this.setupMoodChart();
        this.updatePeriodStartButton();
    }

    // ===== DATE UTILITIES =====
    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    daysBetween(date1, date2) {
        const timeDiff = Math.abs(date2.getTime() - date1.getTime());
        return Math.ceil(timeDiff / (1000 * 3600 * 24));
    }

    // ===== CYCLE CALCULATIONS =====
    getCurrentCycleInfo() {
        const today = new Date();
        const lastPeriod = this.lastPeriodStart ? new Date(this.lastPeriodStart) : null;
        const cycleLength = this.averageCycleLength;

        if (!lastPeriod) {
            return {
                phase: 'unknown',
                dayOfCycle: 0,
                daysUntilPeriod: 0,
                nextPeriodDate: null,
                fertileStart: null,
                fertileEnd: null,
                ovulationDate: null
            };
        }

        // Calculate days since last period (0 = same day, 1 = next day, etc.)
        const daysSinceLastPeriod = Math.floor((today - lastPeriod) / (1000 * 60 * 60 * 24));
        const dayOfCycle = (daysSinceLastPeriod % cycleLength) + 1;
        const daysUntilPeriod = cycleLength - dayOfCycle + 1;
        
        const nextPeriodDate = this.addDays(lastPeriod, cycleLength);
        const ovulationDate = this.addDays(lastPeriod, Math.floor(cycleLength / 2));
        const fertileStart = this.addDays(ovulationDate, -5);
        const fertileEnd = this.addDays(ovulationDate, 1);

        let phase = 'normal';
        if (dayOfCycle <= 5) {
            phase = 'period';
        } else if (dayOfCycle >= Math.floor(cycleLength / 2) - 5 && dayOfCycle <= Math.floor(cycleLength / 2) + 1) {
            phase = 'fertile';
        } else if (dayOfCycle === Math.floor(cycleLength / 2)) {
            phase = 'ovulation';
        } else if (dayOfCycle >= cycleLength - 7) {
            phase = 'pms';
        }

        return {
            phase,
            dayOfCycle,
            daysUntilPeriod,
            nextPeriodDate,
            fertileStart,
            fertileEnd,
            ovulationDate
        };
    }

    getPhaseForDate(date) {
        const dateStr = this.formatDate(date);
        
        // Check if there's a manual phase log for this date
        const cycleLog = this.getCycleLogForDate(dateStr);
        if (cycleLog) {
            return cycleLog.phase;
        }

        const lastPeriod = this.lastPeriodStart ? new Date(this.lastPeriodStart) : null;
        if (!lastPeriod) return 'normal';

        const cycleLength = this.averageCycleLength;
        const daysSinceLastPeriod = Math.floor((date - lastPeriod) / (1000 * 60 * 60 * 24));
        const dayOfCycle = (daysSinceLastPeriod % cycleLength) + 1;

        if (dayOfCycle <= 5) return 'period';
        if (dayOfCycle >= Math.floor(cycleLength / 2) - 5 && dayOfCycle <= Math.floor(cycleLength / 2) + 1) return 'fertile';
        if (dayOfCycle === Math.floor(cycleLength / 2)) return 'ovulation';
        if (dayOfCycle >= cycleLength - 7) return 'pms';
        return 'normal';
    }

    // ===== EVENT LISTENERS =====
    setupEventListeners() {
        // Login
        document.getElementById('loginBtn').addEventListener('click', () => {
            const code = document.getElementById('loginCode').value;
            this.login(code);
        });

        document.getElementById('loginCode').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const code = document.getElementById('loginCode').value;
                this.login(code);
            }
        });

        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchPage(e.target.closest('.nav-btn').dataset.page);
            });
        });

        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        document.getElementById('darkModeToggle').addEventListener('change', (e) => {
            this.setTheme(e.target.checked ? 'dark' : 'bright');
        });

        // Mood tracking
        document.querySelectorAll('#dashboard .mood-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (this.currentUser?.role === 'admin') {
                    this.logMood(parseInt(e.target.dataset.mood));
                }
            });
        });

        // Notes
        document.getElementById('addNoteBtn').addEventListener('click', () => {
            if (this.currentUser?.role === 'admin') {
                this.openNoteModal();
            }
        });

        // Period Start Button
        document.getElementById('periodStartBtn').addEventListener('click', () => {
            if (this.currentUser?.role === 'admin') {
                this.handlePeriodStart();
            }
        });

        // Calendar navigation
        document.getElementById('prevMonth').addEventListener('click', () => {
            this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
            this.renderCalendar();
        });

        document.getElementById('nextMonth').addEventListener('click', () => {
            this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
            this.renderCalendar();
        });

        // Modal controls
        document.getElementById('closeNoteModal').addEventListener('click', () => {
            this.closeModal('noteModal');
        });

        document.getElementById('closeDayModal').addEventListener('click', () => {
            this.closeModal('dayModal');
        });

        document.getElementById('saveNote').addEventListener('click', () => {
            if (this.currentUser?.role === 'admin') {
                this.saveNote();
            }
        });

        document.getElementById('saveDayData').addEventListener('click', () => {
            if (this.currentUser?.role === 'admin') {
                this.saveDayData();
            }
        });

        // Settings
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        document.getElementById('clearAllData').addEventListener('click', () => {
            if (this.currentUser?.role === 'admin') {
                this.clearAllData();
            }
        });

        // Click outside modal to close
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }

    // ===== THEME MANAGEMENT =====
    loadTheme() {
        const savedTheme = localStorage.getItem('camisflow-theme') || 'bright';
        this.setTheme(savedTheme);
    }

    setTheme(theme) {
        document.body.className = `${theme}-mode`;
        localStorage.setItem('camisflow-theme', theme);
        
        const themeToggle = document.getElementById('themeToggle');
        const darkModeToggle = document.getElementById('darkModeToggle');
        
        if (theme === 'dark') {
            themeToggle.textContent = '☀️';
            darkModeToggle.checked = true;
        } else {
            themeToggle.textContent = '🌙';
            darkModeToggle.checked = false;
        }
    }

    toggleTheme() {
        const currentTheme = document.body.className.includes('dark') ? 'dark' : 'bright';
        const newTheme = currentTheme === 'dark' ? 'bright' : 'dark';
        this.setTheme(newTheme);
    }

    // ===== PAGE NAVIGATION =====
    switchPage(pageName) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-page="${pageName}"]`).classList.add('active');

        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById(pageName).classList.add('active');

        if (pageName === 'insights') {
            this.updateInsights();
        }
    }

    // ===== DASHBOARD =====
    updateDashboard() {
        const cycleInfo = this.getCurrentCycleInfo();
        const cycleText = document.getElementById('cycleText');
        const cycleSubtext = document.getElementById('cycleSubtext');

        if (cycleInfo.phase === 'unknown') {
            cycleText.textContent = 'Track your first period to get started!';
            cycleSubtext.textContent = 'Click + to log your period';
        } else if (cycleInfo.phase === 'period') {
            cycleText.textContent = `Period Day ${cycleInfo.dayOfCycle}`;
            cycleSubtext.textContent = `${Math.max(0, 5 - cycleInfo.dayOfCycle + 1)} days remaining`;
        } else {
            cycleText.textContent = `Period in ${cycleInfo.daysUntilPeriod} days`;
            cycleSubtext.textContent = `Day ${cycleInfo.dayOfCycle} of ${this.localData.averageCycleLength}`;
        }

        this.updateCycleIndicator(cycleInfo);
        this.showTodaysMood();
    }

    updateCycleIndicator(cycleInfo) {
        const indicator = document.getElementById('cycleIndicator');
        const dayOfCycle = cycleInfo.dayOfCycle;
        const cycleLength = this.localData.averageCycleLength;
        
        const rotationDegree = (dayOfCycle / cycleLength) * 360;
        
        const existingMarker = indicator.querySelector('.cycle-marker');
        if (existingMarker) existingMarker.remove();
        
        if (dayOfCycle > 0) {
            const marker = document.createElement('div');
            marker.className = 'cycle-marker';
            marker.style.cssText = `
                position: absolute;
                top: 10px;
                left: 50%;
                width: 4px;
                height: 20px;
                background: white;
                transform: translateX(-50%) rotate(${rotationDegree}deg);
                transform-origin: 50% 90px;
                border-radius: 2px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            `;
            indicator.appendChild(marker);
        }
    }

    showTodaysMood() {
        const today = this.formatDate(new Date());
        const todaysMood = this.localData.mood_logs[today];
        
        document.querySelectorAll('#dashboard .mood-btn').forEach(btn => {
            btn.classList.remove('selected');
            if (todaysMood && btn.dataset.mood === todaysMood.toString()) {
                btn.classList.add('selected');
            }
        });
    }

    logMood(mood) {
        const today = this.formatDate(new Date());
        this.localData.mood_logs[today] = mood;
        this.saveLocalData();
        this.showTodaysMood();
    }

    // ===== PERIOD START TRACKING =====
    handlePeriodStart() {
        const today = new Date();
        const todayStr = this.formatDate(today);
        
        // Check if period was already logged today
        const existingLog = this.localData.cycle_logs[todayStr];
        if (existingLog === 'period') {
            this.showError('Period start has already been logged for today.');
            return;
        }
        
        // Mark today as period start
        this.localData.cycle_logs[todayStr] = 'period';
        
        // Update last period start date
        this.localData.lastPeriodStart = todayStr;
        
        // Calculate new cycle length if we have previous data
        this.recalculateCycleLength(today);
        
        // Save data
        this.saveLocalData();
        
        // Update all displays
        this.updateDashboard();
        this.renderMiniCalendar();
        this.renderCalendar();
        this.updatePeriodStartButton();
    }

    recalculateCycleLength(currentPeriodStart) {
        // Find previous period starts to calculate cycle length
        const periodDates = [];
        
        Object.entries(this.localData.cycle_logs).forEach(([date, phase]) => {
            if (phase === 'period') {
                periodDates.push(new Date(date));
            }
        });
        
        // Sort by date (newest first)
        periodDates.sort((a, b) => b - a);
        
        if (periodDates.length >= 2) {
            // Calculate days between the two most recent periods
            const daysBetween = this.daysBetween(periodDates[1], periodDates[0]);
            
            // Only update if the cycle length seems reasonable (21-35 days)
            if (daysBetween >= 21 && daysBetween <= 35) {
                this.localData.averageCycleLength = daysBetween;
            }
        }
    }

    updatePeriodStartButton() {
        const periodStartSection = document.getElementById('periodStartSection');
        const periodStartBtn = document.getElementById('periodStartBtn');
        
        if (!periodStartSection || !periodStartBtn) return;
        
        const today = this.formatDate(new Date());
        const todayLog = this.localData.cycle_logs[today];
        const isAdmin = this.currentUser?.role === 'admin';
        
        // Hide button if period already logged today
        if (todayLog === 'period') {
            periodStartSection.classList.add('hidden');
        } else {
            periodStartSection.classList.remove('hidden');
        }
        
        // Disable for viewers
        periodStartBtn.disabled = !isAdmin;
        
        if (!isAdmin) {
            periodStartBtn.style.opacity = '0.5';
            periodStartBtn.style.cursor = 'not-allowed';
        } else {
            periodStartBtn.style.opacity = '1';
            periodStartBtn.style.cursor = 'pointer';
        }
    }

    // ===== MINI CALENDAR =====
    renderMiniCalendar() {
        const container = document.getElementById('miniCalendar');
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        let html = `
            <div class="mini-calendar-header">
                <h4>${today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h4>
            </div>
            <div class="mini-calendar-grid">
        `;

        const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        weekdays.forEach(day => {
            html += `<div class="mini-day weekday">${day}</div>`;
        });

        const startDay = firstDay.getDay();
        for (let i = 0; i < startDay; i++) {
            html += '<div class="mini-day"></div>';
        }

        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(today.getFullYear(), today.getMonth(), day);
            const dateStr = this.formatDate(date);
            const phase = this.getPhaseForDate(date);
            const isToday = day === today.getDate();
            
            let classes = 'mini-day';
            if (phase === 'period') classes += ' period';
            else if (phase === 'fertile') classes += ' fertile';
            else if (phase === 'ovulation') classes += ' ovulation';
            if (isToday) classes += ' today';

            html += `<div class="${classes}" data-date="${dateStr}" onclick="app.openDayModal('${dateStr}')">${day}</div>`;
        }

        html += '</div>';
        container.innerHTML = html;
    }

    // ===== FULL CALENDAR =====
    renderCalendar() {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        
        document.getElementById('currentMonth').textContent = 
            `${monthNames[this.currentMonth.getMonth()]} ${this.currentMonth.getFullYear()}`;

        const firstDay = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
        const lastDay = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0);
        const today = new Date();

        const grid = document.getElementById('calendarGrid');
        
        const existingDays = grid.querySelectorAll('.calendar-day');
        existingDays.forEach(day => day.remove());

        const startDay = firstDay.getDay();
        for (let i = 0; i < startDay; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-day other-month';
            grid.appendChild(emptyDay);
        }

        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), day);
            const dateStr = this.formatDate(date);
            const phase = this.getPhaseForDate(date);
            const isToday = this.formatDate(date) === this.formatDate(today);
            
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            dayElement.textContent = day;
            dayElement.dataset.date = dateStr;
            
            if (phase === 'period') dayElement.classList.add('period');
            else if (phase === 'fertile') dayElement.classList.add('fertile');
            else if (phase === 'ovulation') dayElement.classList.add('ovulation');
            if (isToday) dayElement.classList.add('today');

            dayElement.addEventListener('click', () => this.openDayModal(dateStr));
            grid.appendChild(dayElement);
        }
    }

    // ===== MODALS =====
    openNoteModal() {
        const today = this.formatDate(new Date());
        const existingNote = this.localData.notes[today] || '';
        document.getElementById('noteInput').value = existingNote;
        document.getElementById('noteModal').style.display = 'block';
    }

    openDayModal(dateStr) {
        this.selectedDate = dateStr;
        const date = new Date(dateStr);
        const phase = this.getPhaseForDate(date);
        const isAdmin = this.currentUser?.role === 'admin';
        
        document.getElementById('dayModalTitle').textContent = 
            date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
        
        const phaseIndicator = document.getElementById('dayPhase');
        const phaseNames = {
            period: 'Period',
            fertile: 'Fertile Window',
            ovulation: 'Ovulation Day',
            pms: 'PMS',
            normal: 'Normal'
        };
        phaseIndicator.textContent = phaseNames[phase] || 'Normal';
        phaseIndicator.className = `phase-indicator ${phase}`;

        // Set mood
        const dayMood = this.localData.mood_logs[dateStr];
        document.querySelectorAll('#dayModal .mood-btn').forEach(btn => {
            btn.classList.remove('selected');
            btn.disabled = !isAdmin;
            if (dayMood && btn.dataset.mood === dayMood.toString()) {
                btn.classList.add('selected');
            }
        });

        // Set notes
        const dayNote = this.localData.notes[dateStr] || '';
        document.getElementById('dayNoteInput').value = dayNote;
        document.getElementById('dayNoteInput').disabled = !isAdmin;

        // Set phase selector
        document.getElementById('phaseSelect').value = phase;
        document.getElementById('phaseSelect').disabled = !isAdmin;

        // Show/hide elements based on permissions
        document.getElementById('phaseSection').style.display = isAdmin ? 'block' : 'none';
        document.getElementById('saveDayData').style.display = isAdmin ? 'block' : 'none';
        document.getElementById('readOnlyNotice').style.display = isAdmin ? 'none' : 'block';

        document.getElementById('dayModal').style.display = 'block';
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    saveNote() {
        const today = this.formatDate(new Date());
        const note = document.getElementById('noteInput').value;
        if (note.trim()) {
            this.localData.notes[today] = note;
        } else {
            delete this.localData.notes[today];
        }
        this.saveLocalData();
        this.closeModal('noteModal');
    }

    saveDayData() {
        if (!this.selectedDate || this.currentUser?.role !== 'admin') return;

        // Save mood
        const selectedMood = document.querySelector('#dayModal .mood-btn.selected');
        if (selectedMood) {
            this.localData.mood_logs[this.selectedDate] = parseInt(selectedMood.dataset.mood);
        }

        // Save note
        const note = document.getElementById('dayNoteInput').value;
        if (note.trim()) {
            this.localData.notes[this.selectedDate] = note;
        } else {
            delete this.localData.notes[this.selectedDate];
        }

        // Save phase
        const phase = document.getElementById('phaseSelect').value;
        if (phase !== 'normal') {
            this.localData.cycle_logs[this.selectedDate] = phase;
        } else {
            delete this.localData.cycle_logs[this.selectedDate];
        }

        this.saveLocalData();
        this.closeModal('dayModal');
        this.updateDashboard();
        this.renderMiniCalendar();
        this.renderCalendar();
    }

    // ===== INSIGHTS =====
    updateInsights() {
        document.getElementById('averageCycle').textContent = `${this.localData.averageCycleLength} days`;
        
        const cycleInfo = this.getCurrentCycleInfo();
        if (cycleInfo.nextPeriodDate) {
            const nextPeriod = cycleInfo.nextPeriodDate;
            const endDate = this.addDays(nextPeriod, 5);
            document.getElementById('nextPeriod').textContent = 
                `${nextPeriod.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        }

        if (cycleInfo.fertileStart && cycleInfo.fertileEnd) {
            document.getElementById('fertileWindow').textContent = 
                `${cycleInfo.fertileStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${cycleInfo.fertileEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        }
    }

    setupMoodChart() {
        const chart = document.getElementById('moodChart');
        const today = new Date();
        
        chart.innerHTML = '';
        
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = this.formatDate(date);
            const mood = this.localData.mood_logs[dateStr] || 3;
            
            const bar = document.createElement('div');
            bar.className = 'mood-bar';
            bar.style.height = `${(mood / 5) * 100}%`;
            bar.title = `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${this.getMoodText(mood)}`;
            chart.appendChild(bar);
        }
    }

    getMoodText(mood) {
        const moodTexts = {
            1: 'Terrible 😡',
            2: 'Sad 😢',
            3: 'Okay 😐',
            4: 'Good 😊',
            5: 'Amazing 😍'
        };
        return moodTexts[mood] || 'Unknown';
    }

    clearAllData() {
        if (confirm('⚠️ This will permanently delete all cycle data, moods, and notes. Are you sure?')) {
            this.localData = {
                users: this.localData.users,
                cycle_logs: {},
                mood_logs: {},
                notes: {},
                lastPeriodStart: null,
                averageCycleLength: 28
            };
            this.saveLocalData();
            this.loadAppData();
            alert('All data has been cleared.');
        }
    }
}

// Initialize the app
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new CamisflowApp();
    
    // Add event listeners for modal mood buttons
    document.addEventListener('click', (e) => {
        if (e.target.matches('#dayModal .mood-btn') && app.currentUser?.role === 'admin') {
            document.querySelectorAll('#dayModal .mood-btn').forEach(btn => btn.classList.remove('selected'));
            e.target.classList.add('selected');
        }
    });
});

// Service Worker for offline functionality (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => console.log('SW registered'))
            .catch(error => console.log('SW registration failed'));
    });
} 