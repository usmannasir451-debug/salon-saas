'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface FeedbackModalProps {
  open: boolean
  onClose: () => void
  ownerId: string
  staffId: string | null
  staffName: string
  clientName: string
  appointmentId?: string
  walkInId?: string
  onSubmitted?: () => void
}

export default function FeedbackModal({
  open,
  onClose,
  ownerId,
  staffId,
  staffName,
  clientName,
  appointmentId,
  walkInId,
  onSubmitted,
}: FeedbackModalProps) {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setRating(0)
    setHovered(0)
    setComment('')
  }

  async function handleSubmit() {
    if (!staffId) {
      toast.error('No staff assigned to rate')
      return
    }
    if (rating === 0) {
      toast.error('Please select a star rating')
      return
    }
    setSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.from('reviews').insert({
      user_id: ownerId,
      staff_id: staffId,
      appointment_id: appointmentId ?? null,
      walk_in_id: walkInId ?? null,
      rating,
      comment: comment.trim() || null,
      client_name: clientName || null,
    })

    if (error) {
      toast.error('Failed to save review')
      setSubmitting(false)
      return
    }

    // Create notification for new review
    await supabase.from('notifications').insert({
      user_id: ownerId,
      type: 'new_review',
      title: 'New Review Received',
      message: `${clientName || 'A client'} gave ${staffName} ${rating} star${rating !== 1 ? 's' : ''}`,
      link: '/reviews',
    })

    toast.success('Thank you for the feedback!')
    reset()
    onClose()
    onSubmitted?.()
    setSubmitting(false)
  }

  const displayRating = hovered || rating

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose() } }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">Rate Your Experience</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-5">
          <div className="text-center space-y-1">
            <p className="text-sm text-gray-500">How was your service with</p>
            <p className="font-semibold text-gray-900">{staffName}</p>
            {clientName && (
              <p className="text-xs text-gray-400">Client: {clientName}</p>
            )}
          </div>

          {/* Star Rating */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                className="focus:outline-none transition-transform hover:scale-110"
              >
                <Star
                  className={`w-9 h-9 transition-colors ${
                    star <= displayRating
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>

          {rating > 0 && (
            <p className="text-center text-sm font-medium text-primary">
              {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
            </p>
          )}

          {/* Comment */}
          <div className="space-y-1.5">
            <p className="text-xs text-gray-500 text-center">Leave a comment (optional)</p>
            <Textarea
              placeholder="Great service, very professional..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => { reset(); onClose() }} disabled={submitting}>
            Skip
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            className="bg-primary hover:bg-primary/90"
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
