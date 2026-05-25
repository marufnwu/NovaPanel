import React, { useState, useMemo } from 'react';
import { useSiteActivities, type SiteActivity, type ActivityFilter, activityTypeConfig, activityFilters } from '../../api/hooks/activities';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Icon } from '../icons';
import { toast } from '../../lib/toast';

interface ActivityFeedProps {
  siteId: string;
  siteName?: string;
  compact?: boolean;
  initialFilter?: ActivityFilter;
  maxHeight?: string;
}

export function ActivityFeed({ 
  siteId, 
  siteName, 
  compact = false, 
  initialFilter = 'all',
  maxHeight = '600px'
}: ActivityFeedProps) {
  const [filter, setFilter] = useState<ActivityFilter>(initialFilter);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(true);
  
  const limit = compact ? 10 : 20;
  
  const { data, isLoading, isError, error, refetch, isFetching } = useSiteActivities(siteId, {
    filter,
    limit,
    page,
  });

  const activities = data?.items || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;

  // Group activities by date for better organization
  const groupedActivities = useMemo(() => {
    const groups: { date: string; activities: SiteActivity[] }[] = [];
    const dateMap = new Map<string, SiteActivity[]>();
    
    activities.forEach(activity => {
      const date = new Date(activity.timestamp).toLocaleDateString();
      if (!dateMap.has(date)) {
        dateMap.set(date, []);
      }
      dateMap.get(date)!.push(activity);
    });
    
    dateMap.forEach((items, date) => {
      groups.push({ date, activities: items });
    });
    
    return groups;
  }, [activities]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Within last minute
    if (diff < 60000) {
      return 'Just now';
    }
    
    // Within last hour
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return `${mins}m ago`;
    }
    
    // Within last day
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }
    
    // Within last week
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days}d ago`;
    }
    
    // Older
    return date.toLocaleDateString();
  };

  const formatFullTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleFilterChange = (newFilter: ActivityFilter) => {
    setFilter(newFilter);
    setPage(1); // Reset to first page when changing filter
  };

  const handleLoadMore = () => {
    if (page < totalPages) {
      setPage(p => p + 1);
    }
  };

  const handleRefresh = () => {
    refetch();
    toast.success('Activity feed refreshed');
  };

  const toggleAutoRefresh = () => {
    setIsAutoRefreshing(!isAutoRefreshing);
    toast.info(isAutoRefreshing ? 'Auto-refresh paused' : 'Auto-refresh enabled');
  };

  const renderActivityIcon = (activity: SiteActivity) => {
    const config = activityTypeConfig[activity.type] || activityTypeConfig.system;
    return (
      <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-background-tertiary ${config.color}`}>
        <Icon name={config.icon as any} size={16} />
      </div>
    );
  };

  const renderActivityDetails = (activity: SiteActivity) => {
    if (!activity.details && !activity.metadata) {
      return null;
    }

    const details = activity.details || {};
    const metadata = activity.metadata || {};

    return (
      <div className="mt-3 pt-3 border-t border-border-tertiary space-y-2">
        {activity.userName && (
          <div className="flex justify-between text-small">
            <span className="text-foreground-tertiary">User</span>
            <span className="text-foreground-secondary">{activity.userName}</span>
          </div>
        )}
        {metadata.ipAddress && (
          <div className="flex justify-between text-small">
            <span className="text-foreground-tertiary">IP Address</span>
            <span className="text-foreground-secondary font-mono">{metadata.ipAddress}</span>
          </div>
        )}
        {Object.entries(details).map(([key, value]) => (
          <div key={key} className="flex justify-between text-small">
            <span className="text-foreground-tertiary capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
            <span className="text-foreground-secondary">
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (isError) {
    return (
      <Card title="Activity Feed">
        <div className="flex flex-col items-center justify-center py-8">
          <Icon name="icon-alert-circle" size={28} className="text-foreground-danger mb-3" />
          <p className="text-small text-foreground-secondary mb-4">
            Failed to load activities
          </p>
          <Button variant="ghost" size="small" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card 
      title="Activity Feed"
      action={
        <div className="flex gap-2 items-center">
          {siteName && !compact && (
            <span className="text-small text-foreground-tertiary mr-2">{siteName}</span>
          )}
          <Button 
            size="small" 
            variant="ghost" 
            onClick={handleRefresh}
            loading={isFetching && !isLoading}
            icon={<Icon name="icon-refresh" size={15} />}
          >
            Refresh
          </Button>
          <button
            onClick={toggleAutoRefresh}
            className={`h-[34px] px-3 text-small rounded-md border transition-colors ${
              isAutoRefreshing 
                ? 'border-foreground-success bg-foreground-success/10 text-foreground-success' 
                : 'border-border-tertiary bg-background-primary text-foreground-secondary'
            }`}
          >
            Live {isAutoRefreshing ? 'ON' : 'OFF'}
          </button>
        </div>
      }
    >
      {/* Filter Bar */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          {activityFilters.slice(0, compact ? 5 : activityFilters.length).map((filterOption) => (
            <button
              key={filterOption.value}
              onClick={() => handleFilterChange(filterOption.value)}
              className={`px-3 py-1.5 text-small rounded-md transition-colors ${
                filter === filterOption.value
                  ? 'bg-foreground-primary text-background-primary'
                  : 'bg-background-tertiary text-foreground-secondary hover:bg-background-tertiary/80'
              }`}
            >
              {filterOption.label}
            </button>
          ))}
        </div>
      </div>

      {/* Status Bar */}
      {!compact && (
        <div className="flex items-center justify-between mb-4 text-meta text-foreground-tertiary">
          <span>
            {total > 0 
              ? `Showing ${activities.length} of ${total} activities`
              : 'No activities'}
          </span>
          {isAutoRefreshing && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-foreground-success animate-pulse" />
              Auto-refreshing every 30s
            </span>
          )}
        </div>
      )}

      {/* Activity List */}
      <div 
        className="space-y-3 overflow-y-auto"
        style={{ maxHeight: compact ? '300px' : maxHeight }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2">
              <Icon name="icon-refresh" size={18} className="animate-spin text-foreground-tertiary" />
              <span className="text-small text-foreground-tertiary">Loading activities...</span>
            </div>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-background-tertiary flex items-center justify-center mb-4">
              <Icon name="icon-activity" size={32} className="text-foreground-tertiary" />
            </div>
            <p className="text-small text-foreground-secondary mb-2">No activities yet</p>
            <p className="text-meta text-foreground-tertiary">
              {filter === 'all' 
                ? 'Activities will appear here as you use your site'
                : `No ${filter.replace(/_/g, ' ')} activities found`}
            </p>
          </div>
        ) : (
          <>
            {groupedActivities.map((group) => (
              <div key={group.date}>
                {/* Date Header */}
                <div className="sticky top-0 bg-background-primary py-2 mb-2 z-10">
                  <span className="text-meta font-medium text-foreground-tertiary">
                    {group.date === new Date().toLocaleDateString() 
                      ? 'Today' 
                      : group.date === new Date(Date.now() - 86400000).toLocaleDateString()
                        ? 'Yesterday'
                        : group.date}
                  </span>
                </div>

                {/* Activities for this date */}
                <div className="space-y-2">
                  {group.activities.map((activity) => {
                    const isExpanded = expandedId === activity.id;
                    const config = activityTypeConfig[activity.type] || activityTypeConfig.system;
                    
                    return (
                      <div
                        key={activity.id}
                        className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                          isExpanded 
                            ? 'bg-background-secondary border-border-tertiary' 
                            : 'bg-background-primary border-transparent hover:bg-background-secondary hover:border-border-tertiary'
                        }`}
                        onClick={() => setExpandedId(isExpanded ? null : activity.id)}
                      >
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          {renderActivityIcon(activity)}
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-small font-medium text-foreground-primary">
                                  {activity.description}
                                </span>
                                {activity.userName && (
                                  <span className="text-meta text-foreground-tertiary">
                                    by {activity.userName}
                                  </span>
                                )}
                              </div>
                              <span className="text-meta text-foreground-tertiary whitespace-nowrap">
                                {formatTimestamp(activity.timestamp)}
                              </span>
                            </div>
                            
                            {/* Activity Type Badge */}
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-meta ${config.color}`}>
                                {config.label}
                              </span>
                              {activity.metadata?.resourceType && (
                                <>
                                  <span className="text-foreground-tertiary">•</span>
                                  <span className="text-meta text-foreground-tertiary">
                                    {activity.metadata.resourceType}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && renderActivityDetails(activity)}

                            {/* Expand indicator */}
                            {(activity.details || activity.metadata) && (
                              <div className="flex items-center gap-1 mt-2 text-meta text-foreground-tertiary">
                                <Icon 
                                  name={isExpanded ? 'icon-chevron-down' : 'icon-chevron-right'} 
                                  size={14} 
                                />
                                <span>{isExpanded ? 'Hide details' : 'Show details'}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Load More */}
            {page < totalPages && (
              <div className="flex justify-center pt-4">
                <Button 
                  variant="default" 
                  size="small" 
                  onClick={handleLoadMore}
                  loading={isLoading}
                >
                  Load More Activities
                </Button>
              </div>
            )}

            {/* End of list indicator */}
            {page >= totalPages && activities.length > 0 && (
              <div className="flex justify-center pt-4 pb-2">
                <span className="text-meta text-foreground-tertiary">
                  You've reached the end • {total} total activities
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

// Compact version for embedding in other components
export function ActivityFeedCompact({ siteId }: { siteId: string }) {
  return (
    <ActivityFeed 
      siteId={siteId} 
      compact={true} 
      maxHeight="300px"
    />
  );
}