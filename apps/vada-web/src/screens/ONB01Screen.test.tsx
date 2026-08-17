import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ONB01Screen } from './ONB01Screen'
import { createEmptyDraft } from '../state/onboarding'
import type { OnboardingDraft } from '../state/onboarding'

const FIND_TIMEOUT = { timeout: 4000 }

function ScreenHarness({ onNavigate = () => {} }: { onNavigate?: (id: string) => void }) {
  const [draft, setDraft] = useState<OnboardingDraft>(createEmptyDraft)
  return <ONB01Screen draft={draft} onChangeDraft={setDraft} onNavigate={onNavigate} />
}

async function pickSchool(user: ReturnType<typeof userEvent.setup>, label: string) {
  const school = screen.getByRole('combobox', { name: '학교*' })
  await user.click(school)
  await user.keyboard('바다')
  await user.click(await screen.findByRole('option', { name: label }, FIND_TIMEOUT))
}

describe('ONB01Screen', () => {
  it('같은 학교를 다시 선택해도 하위 필드를 초기화하지 않는다 (F4)', async () => {
    const user = userEvent.setup()
    render(<ScreenHarness />)

    await pickSchool(user, '바다대학교')

    const college = screen.getByRole('combobox', { name: '단과대학*' })
    await user.click(college)
    await user.click(await screen.findByRole('option', { name: '해양과학대학' }, FIND_TIMEOUT))
    expect(college).toHaveValue('해양과학대학')

    await pickSchool(user, '바다대학교')
    expect(college).toHaveValue('해양과학대학')
  })

  it('다른 학교로 바꾸면 하위 필드를 초기화한다 (resetOnChangeOf)', async () => {
    const user = userEvent.setup()
    render(<ScreenHarness />)

    await pickSchool(user, '바다대학교')
    const college = screen.getByRole('combobox', { name: '단과대학*' })
    await user.click(college)
    await user.click(await screen.findByRole('option', { name: '해양과학대학' }, FIND_TIMEOUT))

    await pickSchool(user, '바다시립대학교')
    expect(college).toHaveValue('')
  })
})
