export function renderMessage(root: HTMLElement, message: string): void {
  root.innerHTML = `
    <div class="page-center">
      <div class="card">
        <p class="message">${message}</p>
      </div>
    </div>
  `;
}

export function renderLoading(root: HTMLElement): void {
  root.innerHTML = `
    <div class="page-center">
      <div class="card">
        <div class="spinner"></div>
      </div>
    </div>
  `;
}
