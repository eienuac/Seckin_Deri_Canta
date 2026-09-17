export default function ProductsLoading() {
  return (
    <div className="container-page py-10 md:py-14">
      <div className="skeleton h-12 w-64" />
      <div className="mt-3 skeleton h-5 w-80" />
      <div className="mt-10 grid gap-10 lg:grid-cols-[260px_1fr]">
        <div className="hidden space-y-4 lg:block">
          <div className="skeleton h-40 w-full" />
          <div className="skeleton h-40 w-full" />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="skeleton aspect-[3/4] w-full" />
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
