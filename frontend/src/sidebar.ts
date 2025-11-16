export class Sidebar {
    private sidebar: HTMLElement | null = null
    private overlay: HTMLElement | null = null
    private closeBtn: HTMLElement | null = null
    private avatarBtn: HTMLElement | null = null

    constructor() {
        this.sidebar = document.getElementById('user-sidebar')
        this.overlay = document.getElementById('sidebar-overlay')
        this.closeBtn = document.getElementById('sidebar-close')
        this.avatarBtn = document.getElementById('header-user-avatar')

        this.setupEventListeners()
    }

    private setupEventListeners(): void {
        // Ouvrir au clic sur l'avatar
        this.avatarBtn?.addEventListener('click', (e) => {
            e.preventDefault()
            this.open()
        })

        // Fermer au clic sur le bouton X
        this.closeBtn?.addEventListener('click', () => {
            this.close()
        })

        // Fermer au clic sur l'overlay
        this.overlay?.addEventListener('click', () => {
            this.close()
        })
    }

    public open(): void {
        this.sidebar?.classList.add('active')
        this.overlay?.classList.add('active')
        console.log('Sidebar opened')
    }

    public close(): void {
        this.sidebar?.classList.remove('active')
        this.overlay?.classList.remove('active')
        console.log('Sidebar closed')
    }
}
