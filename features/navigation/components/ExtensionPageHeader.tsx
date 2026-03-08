import { SidebarTrigger } from '@/components/ui/sidebar'

interface ExtensionPageHeaderProps {
  description?: string
  title: string
}

export const ExtensionPageHeader = ({
  description,
  title,
}: ExtensionPageHeaderProps) => {
  return (
    <header className='mb-8 flex items-start justify-between gap-4'>
      <div className='flex items-start gap-3'>
        <SidebarTrigger className='mt-1 cursor-pointer' />
        <div>
          <h1 className='font-bold text-3xl text-foreground'>{title}</h1>
          {description ? (
            <p className='mt-2 max-w-3xl text-muted-foreground text-sm leading-6'>
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  )
}
