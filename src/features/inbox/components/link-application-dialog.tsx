'use client'

import { useState } from 'react'

import { Button } from '@/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/dialog'

type Application = {
  id: number
  roleTitle: string
  companyName: string
}

type Props = {
  emailId: number
  applications: Application[]
  onLink: (emailId: number, applicationId: number) => void
}

export function LinkApplicationDialog({
  emailId,
  applications,
  onLink,
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = applications.filter(
    (app) =>
      app.roleTitle.toLowerCase().includes(search.toLowerCase()) ||
      app.companyName.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Link
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link to application</DialogTitle>
        </DialogHeader>
        <input
          type="text"
          placeholder="Search by role or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <div className="max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No applications found.
            </p>
          ) : (
            filtered.map((app) => (
              <button
                key={app.id}
                onClick={() => {
                  onLink(emailId, app.id)
                  setOpen(false)
                  setSearch('')
                }}
                className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
              >
                {app.roleTitle} — {app.companyName}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
