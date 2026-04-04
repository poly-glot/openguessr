import { css } from 'lit'

export const buttonStyles = css`
  button {
    appearance: none;
    background: var(--brand, #111);
    border: 1px solid var(--brand, #111);
    color: var(--brand-text, #fff);
    cursor: pointer;
    min-width: 150px;
    padding: 10px 20px;
    text-align: center;
    text-transform: uppercase;
  }

  button[disabled] {
    opacity: 0.3;
  }

  button:focus,
  button:hover,
  button:active {
    background-color: var(--brand-highlight, #333);
  }
`

export const inputStyles = css`
  input[type="text"] {
    border: 1px solid var(--borderColor, rgb(0 0 0 / 15%));
    padding: 5px 10px;
    width: 100%;
    box-sizing: border-box;
    font-size: inherit;
    font-family: inherit;
  }

  input[type="text"]:focus {
    outline: none;
    border-color: var(--brand, #111);
    box-shadow: 0 0 0 2px rgb(0 0 0 / 10%);
  }

  input[aria-invalid="true"] {
    border-color: var(--color-error, #ac1b11);
  }

  label {
    display: block;
    font-size: 0.75rem;
    margin-bottom: 4px;
    text-transform: uppercase;
  }
`
