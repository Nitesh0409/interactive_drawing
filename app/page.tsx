import DrawingBoard from "@/components/drawing-board"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center">
      <div className="w-full max-w-7xl px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">DrawMaster</h1>
          <p className="mt-2 text-lg text-gray-600">An interactive drawing tool for teaching</p>
        </div>
        <DrawingBoard />
      </div>
    </main>
  )
}
