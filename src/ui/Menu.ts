export class Menu {
    private menuElement: HTMLElement;
  
    constructor() {
      this.menuElement = document.getElementById('menu')!;
      this.createMenu();
    }
  
    private createMenu() {
      // Ejemplo de menú simple
      this.menuElement.innerHTML = `
        <button id="btn-save">Guardar Mundo</button>
        <button id="btn-load">Cargar Mundo</button>
      `;
      document.getElementById('btn-save')?.addEventListener('click', () => {
        console.log('Guardando el mundo...');
        // Implementar guardado (LocalStorage o IndexedDB)
      });
      document.getElementById('btn-load')?.addEventListener('click', () => {
        console.log('Cargando el mundo...');
        // Implementar carga
      });
    }
  }
  