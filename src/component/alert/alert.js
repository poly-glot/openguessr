const AUTO_DISMISS_MS = 4000

export class Alert {
  init () {
    this._elem = document.getElementById('js-alert')
    this._queue = []
    this._timer = null
  }

  announce (text, category = 'info') {
    if (!this._elem) return

    this._queue.push({ text, category })

    if (this._queue.length === 1) {
      this._showNext()
    } else {
      this._updateBadge()
    }
  }

  _showNext () {
    if (!this._elem || this._queue.length === 0) return

    const { text, category } = this._queue[0]
    this._elem.textContent = text
    this._elem.dataset.category = category
    this._updateBadge()

    clearTimeout(this._timer)
    this._timer = setTimeout(() => this._dismiss(), AUTO_DISMISS_MS)
  }

  _dismiss () {
    this._queue.shift()
    if (this._queue.length > 0) {
      this._showNext()
    } else {
      if (this._elem) {
        this._elem.textContent = ''
        this._elem.removeAttribute('data-category')
        this._elem.removeAttribute('data-count')
      }
    }
  }

  _updateBadge () {
    if (!this._elem) return
    if (this._queue.length > 1) {
      this._elem.dataset.count = this._queue.length
    } else {
      this._elem.removeAttribute('data-count')
    }
  }
}

export default new Alert()
