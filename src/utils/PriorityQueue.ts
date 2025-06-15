export class PriorityQueue<T> {
  private heap: T[] = [];
  constructor(private comparator: (a: T, b: T) => number) {}

  public size(): number {
    return this.heap.length;
  }

  public push(value: T): void {
    this.heap.push(value);
    this.bubbleUp(this.heap.length - 1);
  }

  public pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(index: number): void {
    const element = this.heap[index];
    while (index > 0) {
      const parentIndex = (index - 1) >> 1;
      const parent = this.heap[parentIndex];
      if (this.comparator(element, parent) >= 0) break;
      this.heap[index] = parent;
      this.heap[parentIndex] = element;
      index = parentIndex;
    }
  }

  private sinkDown(index: number): void {
    const length = this.heap.length;
    const element = this.heap[index];
    while (true) {
      let leftIndex = (index << 1) + 1;
      let rightIndex = leftIndex + 1;
      let smallest = index;

      if (leftIndex < length && this.comparator(this.heap[leftIndex], this.heap[smallest]) < 0) {
        smallest = leftIndex;
      }
      if (rightIndex < length && this.comparator(this.heap[rightIndex], this.heap[smallest]) < 0) {
        smallest = rightIndex;
      }
      if (smallest === index) break;
      this.heap[index] = this.heap[smallest];
      this.heap[smallest] = element;
      index = smallest;
    }
  }
}
