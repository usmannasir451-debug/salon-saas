'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import { Star, MessageSquare, Loader2, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Review = {
  id: string
  rating: number
  comment: string | null
  client_name: string | null
  created_at: string
  staff: { name: string } | null
}

function StarDisplay({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5'
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(cls, s <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200')}
        />
      ))}
    </div>
  )
}

const ratingLabel: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
}

const ratingColor: Record<number, string> = {
  1: 'bg-red-50 text-red-700 border-red-200',
  2: 'bg-orange-50 text-orange-700 border-orange-200',
  3: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  4: 'bg-blue-50 text-blue-700 border-blue-200',
  5: 'bg-green-50 text-green-700 border-green-200',
}

export default function ReviewsPage() {
  const { role, ownerId } = useUserContext()
  const router = useRouter()

  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRating, setFilterRating] = useState(0)

  useEffect(() => {
    if (!['owner', 'manager'].includes(role)) { router.replace('/appointments'); return }
    loadReviews()
  }, [role, router]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadReviews() {
    const supabase = createClient()
    const { data } = await supabase
      .from('reviews')
      .select('*, staff(name)')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false })
    setReviews((data ?? []) as Review[])
    setLoading(false)
  }

  const filtered = reviews.filter((r) => {
    const matchSearch =
      !search ||
      r.staff?.name.toLowerCase().includes(search.toLowerCase()) ||
      r.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.comment?.toLowerCase().includes(search.toLowerCase())
    const matchRating = !filterRating || r.rating === filterRating
    return matchSearch && matchRating
  })

  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0

  const ratingDist = [5, 4, 3, 2, 1].map((r) => ({
    rating: r,
    count: reviews.filter((x) => x.rating === r).length,
    pct: reviews.length ? (reviews.filter((x) => x.rating === r).length / reviews.length) * 100 : 0,
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Star className="w-6 h-6 text-primary" />
          Reviews & Ratings
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Customer feedback across all staff</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Overall rating */}
        <Card className="sm:col-span-1">
          <CardContent className="p-5 text-center">
            <p className="text-5xl font-bold text-gray-900">{avgRating ? avgRating.toFixed(1) : '—'}</p>
            <div className="flex justify-center mt-2">
              <StarDisplay rating={Math.round(avgRating)} size="lg" />
            </div>
            <p className="text-sm text-gray-500 mt-1">{reviews.length} total reviews</p>
            {avgRating > 0 && (
              <Badge className={cn('mt-2', ratingColor[Math.round(avgRating)])}>
                {ratingLabel[Math.round(avgRating)]}
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Rating distribution */}
        <Card className="sm:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Rating Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ratingDist.map(({ rating, count, pct }) => (
              <div key={rating} className="flex items-center gap-3">
                <div className="flex items-center gap-0.5 w-20 flex-shrink-0">
                  <span className="text-xs text-gray-600 w-3">{rating}</span>
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                </div>
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 bg-yellow-400 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-6 text-right">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search by staff, client, or comment..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Filter:</span>
          {[0, 5, 4, 3, 2, 1].map((r) => (
            <button
              key={r}
              onClick={() => setFilterRating(r === filterRating ? 0 : r)}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors',
                filterRating === r && r !== 0
                  ? 'bg-primary text-white border-primary'
                  : filterRating === r
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              )}
            >
              {r === 0 ? 'All' : (
                <>
                  {r} <Star className={cn('w-2.5 h-2.5', filterRating === r ? 'fill-white text-white' : 'fill-yellow-400 text-yellow-400')} />
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
            <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              {reviews.length === 0 ? 'No reviews yet. Reviews appear after appointments are completed.' : 'No reviews match your filter.'}
            </p>
          </div>
        ) : (
          filtered.map((r) => (
            <Card key={r.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-bold text-sm">
                      {(r.client_name ?? 'A')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-900 text-sm">
                          {r.client_name ?? 'Anonymous'}
                        </p>
                        <Badge className={cn('text-[10px] px-1.5', ratingColor[r.rating])}>
                          {ratingLabel[r.rating]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StarDisplay rating={r.rating} />
                        {r.staff && (
                          <span className="text-xs text-gray-400">for {r.staff.name}</span>
                        )}
                      </div>
                      {r.comment && (
                        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                          &ldquo;{r.comment}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 flex-shrink-0">
                    {format(new Date(r.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
