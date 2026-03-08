import {
  Clock3,
  Folder,
  FolderTree,
  Globe,
  MessageCircleMore,
  Wrench,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  type SidebarItemId,
  type SidebarState,
  getPageHref,
  getSavedTabsHrefForMode,
} from '@/features/navigation/lib/pageNavigation'
import { cn } from '@/lib/utils'

interface ExtensionSidebarProps {
  state: SidebarState
}

const LinkLabel = ({
  href,
  isActive,
  label,
  children,
}: {
  href: string
  isActive: boolean
  label: string
  children: React.ReactNode
}) => (
  <a
    aria-current={isActive ? 'page' : undefined}
    aria-label={label}
    className={cn(expandedNavLinkClass, isActive && expandedNavLinkActiveClass)}
    href={href}
  >
    {children}
  </a>
)

const topLevelItems: Array<{
  icon: React.ComponentType<{ className?: string }>
  id: SidebarItemId
  label: string
}> = [
  {
    icon: MessageCircleMore,
    id: 'ai-chat',
    label: 'チャット',
  },
  {
    icon: Clock3,
    id: 'periodic-execution',
    label: '定期実行',
  },
]

const tabListItems: Array<{
  icon: React.ComponentType<{ className?: string }>
  id: SidebarItemId
  label: string
}> = [
  {
    icon: Globe,
    id: 'saved-tabs-domain',
    label: 'ドメインモード',
  },
  {
    icon: Folder,
    id: 'saved-tabs-custom',
    label: 'カスタムモード',
  },
]

const expandedPrimaryButtonClass = 'rounded-xl p-0'
const expandedNavLinkClass =
  'flex min-h-11 w-full min-w-0 items-center justify-start gap-3 rounded-xl px-4 text-base font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
const expandedNavLinkActiveClass =
  'bg-sidebar-accent text-sidebar-accent-foreground'
const expandedSubmenuClass =
  'mx-0 mt-1 ml-4 gap-1.5 border-sidebar-border/70 px-0 py-0 pl-4'
const iconRailLinkClass =
  'flex size-11 items-center justify-center rounded-2xl text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
const ICON_RAIL_WIDTH_PX = 48

interface RailItem {
  href: string
  icon: React.ComponentType<{ className?: string }>
  isActive: boolean
  label: string
  rel?: string
  target?: string
}

const IconRailLink = ({
  href,
  icon: Icon,
  isActive,
  label,
  rel,
  target,
}: RailItem) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <a
        aria-current={isActive ? 'page' : undefined}
        aria-label={label}
        className={cn(
          iconRailLinkClass,
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'bg-transparent',
        )}
        data-active={isActive}
        href={href}
        rel={rel}
        target={target}
      >
        <Icon className='size-5 shrink-0' />
      </a>
    </TooltipTrigger>
    <TooltipContent side='right' align='center'>
      {label}
    </TooltipContent>
  </Tooltip>
)

export const ExtensionSidebar = ({ state }: ExtensionSidebarProps) => {
  const { open, sidebarWidth } = useSidebar()
  const isIconCollapsed = open && sidebarWidth <= ICON_RAIL_WIDTH_PX
  const savedTabsHref = getSavedTabsHrefForMode(
    state.item === 'saved-tabs-custom' ? 'custom' : 'domain',
  )
  const railItems: RailItem[] = [
    {
      href: savedTabsHref,
      icon: FolderTree,
      isActive: state.item.startsWith('saved-tabs-'),
      label: 'タブ一覧',
    },
    ...topLevelItems.map(item => ({
      href: getPageHref(item.id),
      icon: item.icon,
      isActive: state.item === item.id,
      label: item.label,
    })),
  ]
  const optionItem: RailItem = {
    href: 'options.html',
    icon: Wrench,
    isActive: false,
    label: 'オプション',
    rel: 'noreferrer',
    target: '_blank',
  }

  return (
    <Sidebar>
      <SidebarHeader
        className={cn('gap-1 px-3 py-3', isIconCollapsed && 'px-0 py-2')}
      >
        <div className='flex items-center justify-center gap-2 rounded-lg py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0'>
          <div className='min-w-0 group-data-[collapsible=icon]:hidden'>
            <p className='font-semibold text-3xl leading-none'>TABBIN</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className={cn(isIconCollapsed && 'items-center')}>
        <SidebarGroup className={cn(isIconCollapsed && 'w-full px-0 py-2')}>
          <SidebarGroupContent>
            {isIconCollapsed ? (
              <div className='flex h-full flex-col items-center'>
                <div className='flex flex-col items-center gap-3 pt-2'>
                  {railItems.map(item => (
                    <IconRailLink key={item.label} {...item} />
                  ))}
                </div>
              </div>
            ) : (
              <SidebarMenu className='gap-1.5'>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={state.item.startsWith('saved-tabs-')}
                    className={expandedPrimaryButtonClass}
                    size='lg'
                    tooltip='タブ一覧'
                    asChild
                  >
                    <a
                      aria-current={
                        state.item.startsWith('saved-tabs-')
                          ? 'page'
                          : undefined
                      }
                      aria-label='タブ一覧'
                      className={cn(
                        expandedNavLinkClass,
                        state.item.startsWith('saved-tabs-') &&
                          expandedNavLinkActiveClass,
                      )}
                      href={savedTabsHref}
                    >
                      <FolderTree className='size-5 shrink-0' />
                      <span className='group-data-[collapsible=icon]:hidden'>
                        タブ一覧
                      </span>
                    </a>
                  </SidebarMenuButton>
                  <SidebarMenuSub className={expandedSubmenuClass}>
                    {tabListItems.map(item => (
                      <SidebarMenuSubItem key={item.id}>
                        <SidebarMenuSubButton
                          className='h-11 gap-3 rounded-xl px-4 text-base'
                          href={getPageHref(item.id)}
                          isActive={state.item === item.id}
                        >
                          <item.icon className='size-4' />
                          <span>{item.label}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </SidebarMenuItem>
                {topLevelItems.map(item => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={state.item === item.id}
                      className={expandedPrimaryButtonClass}
                      size='lg'
                      tooltip={item.label}
                      asChild
                    >
                      <LinkLabel
                        href={getPageHref(item.id)}
                        isActive={state.item === item.id}
                        label={item.label}
                      >
                        <item.icon className='size-5 shrink-0' />
                        <span className='group-data-[collapsible=icon]:hidden'>
                          {item.label}
                        </span>
                      </LinkLabel>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter
        className={cn(
          'border-sidebar-border border-t p-3',
          isIconCollapsed && 'items-center px-0 py-3',
        )}
      >
        {isIconCollapsed ? (
          <IconRailLink {...optionItem} />
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                className='rounded-xl p-0'
                tooltip='オプション'
                asChild
              >
                <a
                  aria-label='オプション'
                  className={expandedNavLinkClass}
                  href='options.html'
                  target='_blank'
                  rel='noreferrer'
                >
                  <Wrench className='size-5 shrink-0' />
                  <span className='group-data-[collapsible=icon]:hidden'>
                    オプション
                  </span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
