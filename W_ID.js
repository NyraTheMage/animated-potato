class W_ID {
  #id=0;

  // Constructor to initialize state
  constructor(initialState) {
    this.#id = initialState || 0;
  }

  getNew() {
    this.#id+=1
    return this.#id
  }

  viewCurrent(){
    return this.#id
  }

  resetCount(){
    this.#id = 0
  }
}