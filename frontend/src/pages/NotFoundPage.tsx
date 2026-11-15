import { Link } from 'react-router-dom'
import { PageBody, PageHeader, PageTitle } from '@/components/izden/PageHeader'

export function NotFoundPage() {
  return (
    <>
      <PageHeader crumbs={[{ label: 'Не найдено' }]} />
      <PageBody>
        <div className="flex flex-col gap-2">
          <PageTitle>Страница не найдена</PageTitle>
          <Link to="/" className="text-teacher-ink hover:underline">
            К заданиям
          </Link>
        </div>
      </PageBody>
    </>
  )
}
