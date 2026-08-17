import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchSelect } from './SearchSelect'
import type { Option } from '../option-sources/catalog'

const FIND_TIMEOUT = { timeout: 4000 }

function SchoolHarness() {
  const [value, setValue] = useState<Option | null>(null)
  return (
    <div>
      <SearchSelect
        id="school"
        placeholder="학교명을 검색하세요"
        searchable
        disabled={false}
        sourceKey="education.schools"
        sourceParams={{}}
        value={value}
        onSelect={setValue}
      />
      <label>
        다른 필드
        <input />
      </label>
    </div>
  )
}

function CollegeHarness({ schoolId }: { schoolId: string }) {
  const [value, setValue] = useState<Option | null>(null)
  return (
    <SearchSelect
      id="college"
      placeholder="학교를 먼저 선택하세요"
      searchable
      disabled={false}
      sourceKey="education.colleges"
      sourceParams={{ schoolId }}
      value={value}
      onSelect={setValue}
    />
  )
}

describe('SearchSelect', () => {
  it('Tab 포커스만으로 열리지 않고, 포커스가 떠나면 닫힌다 (F1)', async () => {
    const user = userEvent.setup()
    render(<SchoolHarness />)
    const combo = screen.getByRole('combobox')

    await user.tab()
    expect(combo).toHaveFocus()
    expect(screen.queryByText('학교명을 2자 이상 입력하세요')).not.toBeInTheDocument()

    await user.click(combo)
    expect(await screen.findByText('학교명을 2자 이상 입력하세요')).toBeInTheDocument()

    await user.tab()
    expect(screen.queryByText('학교명을 2자 이상 입력하세요')).not.toBeInTheDocument()
  })

  it('선택 후 닫힌 입력은 선택한 라벨을 표시한다 (F1)', async () => {
    const user = userEvent.setup()
    render(<SchoolHarness />)
    const combo = screen.getByRole('combobox')

    await user.click(combo)
    await user.keyboard('바다')
    await user.click(await screen.findByRole('option', { name: '바다대학교' }, FIND_TIMEOUT))

    expect(combo).toHaveValue('바다대학교')
    await user.tab()
    expect(combo).toHaveValue('바다대학교')
  })

  it('화살표와 Enter로 옵션을 선택할 수 있다 (F2)', async () => {
    const user = userEvent.setup()
    render(<SchoolHarness />)
    const combo = screen.getByRole('combobox')

    await user.click(combo)
    await user.keyboard('바다')
    await screen.findByRole('option', { name: '바다대학교' }, FIND_TIMEOUT)

    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(combo).toHaveValue('부산바다대학교')
  })

  it('상위 값이 바뀐 뒤 다시 열면 이전 목록 없이 로딩부터 시작한다 (F3 회귀 고정)', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<CollegeHarness schoolId="sch-001" />)
    const combo = screen.getByRole('combobox')

    await user.click(combo)
    await screen.findByRole('option', { name: '해양과학대학' }, FIND_TIMEOUT)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('option', { name: '해양과학대학' })).not.toBeInTheDocument()

    rerender(<CollegeHarness schoolId="sch-002" />)
    await user.click(combo)
    expect(screen.queryByRole('option', { name: '해양과학대학' })).not.toBeInTheDocument()
    expect(screen.getByText('단과대학 목록을 불러오는 중입니다')).toBeInTheDocument()
    expect(
      await screen.findByRole('option', { name: '해사대학' }, FIND_TIMEOUT),
    ).toBeInTheDocument()
  })

  it('로딩·상태 문구는 listbox 밖의 status로 안내한다 (F6)', async () => {
    const user = userEvent.setup()
    render(<CollegeHarness schoolId="sch-001" />)

    await user.click(screen.getByRole('combobox'))
    expect(screen.getByRole('status')).toHaveTextContent('단과대학 목록을 불러오는 중입니다')

    const listbox = await screen.findByRole('listbox', {}, FIND_TIMEOUT)
    expect(within(listbox).getAllByRole('option')).toHaveLength(3)
    expect(within(listbox).queryByRole('status')).not.toBeInTheDocument()
  })
})
