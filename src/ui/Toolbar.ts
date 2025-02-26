export class Toolbar {
    private toolbarElement: HTMLElement;
  
    constructor() {
      this.toolbarElement = document.getElementById('toolbar')!;
      this.createToolbar();
    }
  
    private createToolbar() {
      const blockTypes = ['Grass', 'Dirt', 'Stone'];
      blockTypes.forEach((type) => {
        const btn = document.createElement('button');
        btn.innerText = type;
        btn.onclick = () => {
          console.log(`Bloque seleccionado: ${type}`);
          // Aquí se puede actualizar el estado del juego para colocar el bloque seleccionado
        };
        this.toolbarElement.appendChild(btn);
      });
    }
  }
  