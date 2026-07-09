export function renderCompletePage(root: HTMLElement): void {
  root.innerHTML = `
    <div class="page-center">
      <div class="card">
        <p class="message">投票が完了しました。</p>
      </div>
    </div>
  `;
}
