export class Alert {
  init () {
    this._elem = document.getElementById('js-alert')
  }

  announce (text) {
    if (this._elem) {
      this._elem.textContent = text
    }
  }
}

export default new Alert()
