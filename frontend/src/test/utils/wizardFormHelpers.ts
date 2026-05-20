import { within, type HTMLElement } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'

/** Step 1 exposes six text inputs in DOM order before the optional numeric stat field. */
export async function fillStep1Contact(container: HTMLElement) {
  const values = ['Cohen', 'Dana Cohen', '0501234567', 'dana@example.com', 'Eilat', '1 Herzl St']
  const inputs = within(container).getAllByRole('textbox')

  for (let i = 0; i < values.length; i += 1) {
    await userEvent.clear(inputs[i])
    await userEvent.type(inputs[i], values[i])
  }
}

export async function advanceThroughRemainingSteps(container: HTMLElement, steps = 6) {
  for (let i = 0; i < steps; i += 1) {
    await userEvent.click(within(container).getByRole('button', { name: 'הבא' }))
  }
}
