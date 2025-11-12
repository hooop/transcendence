import mainTemplate from './templates/main.html?raw'


export class App
{
	private container: HTMLElement | null = null

	mount(selector: string): void
	{
		this.container = document.querySelector(selector)

		if (!this.container) {
			throw new Error(`Container ${selector} not found`)
		}

		this.render()
	}

	// INJECTION DU HTML DU MAIN
	private render(): void
	{
		if (!this.container) return

		this.container.innerHTML = mainTemplate

	}

}
