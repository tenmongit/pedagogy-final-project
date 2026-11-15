import { Link } from 'react-router-dom'
import { PageBody, PageHeader, PageTitle } from '@/components/izden/PageHeader'
import { useT } from '@/i18n/context'

export function NotFoundPage() {
  const t = useT()
  return (
    <>
      <PageHeader crumbs={[{ label: t.notFound.crumb }]} />
      <PageBody>
        <div className="flex flex-col gap-2">
          <PageTitle>{t.notFound.title}</PageTitle>
          <Link to="/" className="text-teacher-ink hover:underline">
            {t.notFound.back}
          </Link>
        </div>
      </PageBody>
    </>
  )
}
