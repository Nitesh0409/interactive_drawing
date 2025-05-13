"use client"

import type React from "react"

import { useRef, useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Trash2,
  Download,
  Undo2,
  Square,
  Circle,
  Type,
  Pencil,
  Eraser,
  Palette,
  Minus,
  Plus,
  Maximize,
  Minimize,
  HelpCircle,
  MinusIcon,
  Check,
  X,
  Move,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"

const colors = [
  "#000000", // Black
  "#ffffff", // White
  "#ff0000", // Red
  "#00ff00", // Green
  "#0000ff", // Blue
  "#ffff00", // Yellow
  "#ff00ff", // Magenta
  "#00ffff", // Cyan
  "#ff8000", // Orange
  "#8000ff", // Purple
]

type Tool = "pen" | "eraser" | "rectangle" | "circle" | "text" | "line" | "select"
type DrawingHistory = ImageData[]
type TextObject = {
  id: string
  text: string
  x: number
  y: number
  fontSize: number
  color: string
  isEditing: boolean
}

export default function DrawingBoard() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [color, setColor] = useState("#000000")
  const [fillColor, setFillColor] = useState("")
  const [useFill, setUseFill] = useState(false)
  const [brushSize, setBrushSize] = useState(5)
  const [eraserSize, setEraserSize] = useState(20)
  const [capsLockEnabled, setCapsLockEnabled] = useState(false)
  const [drawWithoutClick, setDrawWithoutClick] = useState(false)
  const [tool, setTool] = useState<Tool>("pen")
  const [history, setHistory] = useState<DrawingHistory>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 })
  const [textObjects, setTextObjects] = useState<TextObject[]>([])
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null)
  const [textFontSize, setTextFontSize] = useState(16)
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const touchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const multiTouchRef = useRef<boolean>(false)
  const lastPanPositionRef = useRef<{ x: number; y: number } | null>(null)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null)
  const [isMovingText, setIsMovingText] = useState(false)
  const [movingTextId, setMovingTextId] = useState<string | null>(null)
  const [movingTextOffset, setMovingTextOffset] = useState({ x: 0, y: 0 })

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;
  
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d", { willReadFrequently: true });
  
    if (context) {
      setCtx(context);
  
      // Set canvas size
      resizeCanvas();
  
      // Save initial canvas state
      const initialState = context.getImageData(0, 0, canvas.width, canvas.height);
      setHistory([initialState]);
      setHistoryIndex(0);
    }
  
    window.addEventListener("resize", resizeCanvas);
  
    // Handle Caps Lock on key events
    const handleKeyboardEvent = (e: KeyboardEvent) => {
      const isCapsLock = e.getModifierState?.("CapsLock") || false;
      setCapsLockEnabled(isCapsLock);
      setDrawWithoutClick(isCapsLock);

      if (isCapsLock) {
        lastPositionRef.current = null;
      }
    };
  
    window.addEventListener("keydown", handleKeyboardEvent);
    window.addEventListener("keyup", handleKeyboardEvent);
  
    // Check initial Caps Lock state safely
    try {
      const testEvent = new KeyboardEvent("keydown");
      const initialCapsLock = testEvent.getModifierState("CapsLock");
      setCapsLockEnabled(initialCapsLock);
      setDrawWithoutClick(initialCapsLock);

      if (initialCapsLock) {
        lastPositionRef.current = null;
      }
    } catch {
      setCapsLockEnabled(false);
      setDrawWithoutClick(false);
    }
  
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("keydown", handleKeyboardEvent);
      window.removeEventListener("keyup", handleKeyboardEvent);
    };
  }, []);
  

  // Redraw text objects when they change
  useEffect(() => {
    redrawCanvas()
  }, [textObjects])

  const resizeCanvas = () => {
    if (!canvasRef.current || !containerRef.current) return

    const canvas = canvasRef.current
    const container = containerRef.current

    canvas.width = container.clientWidth
    canvas.height = container.clientHeight

    // Redraw canvas after resize
    redrawCanvas()
  }

  const redrawCanvas = () => {
    if (!ctx || !canvasRef.current || historyIndex < 0 || history.length === 0) return

    // Redraw the base canvas from history
    ctx.putImageData(history[historyIndex], 0, 0)

    // Redraw all text objects that aren't being edited
    textObjects.forEach((textObj) => {
      if (!textObj.isEditing) {
        ctx.font = `${textObj.fontSize}px Arial`
        ctx.fillStyle = textObj.color
        ctx.fillText(textObj.text, textObj.x, textObj.y)
      }
    })
  }

  // Save canvas state to history
  const saveToHistory = () => {
    if (!canvasRef.current || !ctx) return

    const canvas = canvasRef.current
    const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height)

    // Remove any states after current index
    const newHistory = history.slice(0, historyIndex + 1)

    setHistory([...newHistory, currentState])
    setHistoryIndex(newHistory.length)
  }

  // Undo function
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)

      if (ctx && canvasRef.current) {
        ctx.putImageData(history[newIndex], 0, 0)
        redrawCanvas()
      }
    }
  }

  // Clear canvas
  const handleClear = () => {
    if (!ctx || !canvasRef.current) return

    const canvas = canvasRef.current
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setTextObjects([])

    // Save cleared state to history
    saveToHistory()
  }

  // Download canvas as image
  const handleDownload = () => {
    if (!canvasRef.current) return

    // First make sure all text is rendered to the canvas
    redrawCanvas()

    const canvas = canvasRef.current
    const dataUrl = canvas.toDataURL("image/png")

    const link = document.createElement("a")
    link.download = "drawing.png"
    link.href = dataUrl
    link.click()
  }

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
    setTimeout(resizeCanvas, 100)
  }

  // Get canvas coordinates from pointer event
  const getCanvasCoordinates = (e: React.PointerEvent | React.MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 }

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / scale - panOffset.x,
      y: (e.clientY - rect.top) / scale - panOffset.y,
    }
  }

  // Handle mouse/touch events
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!ctx || !canvasRef.current) return

    const { x, y } = getCanvasCoordinates(e)

    // Check if we're clicking on a text object
    if (tool === "select" || tool === "text") {
      const clickedTextIndex = textObjects.findIndex(
        (textObj) =>
          x >= textObj.x - 5 &&
          x <= textObj.x + ctx.measureText(textObj.text).width + 5 &&
          y >= textObj.y - textObj.fontSize &&
          y <= textObj.y + 5,
      )

      if (clickedTextIndex !== -1) {
        const clickedText = textObjects[clickedTextIndex]
        setSelectedTextId(clickedText.id)

        if (tool === "text") {
          // Start editing the text
          const updatedTextObjects = textObjects.map((textObj) => ({
            ...textObj,
            isEditing: textObj.id === clickedText.id,
          }))
          setTextObjects(updatedTextObjects)
        } else if (tool === "select") {
          // Start moving the text
          setIsMovingText(true)
          setMovingTextId(clickedText.id)
          setMovingTextOffset({
            x: x - clickedText.x,
            y: y - clickedText.y,
          })
        }
        return
      }
    }

    if (tool === "text") {
      // Create a new text object at this position
      const newTextId = `text-${Date.now()}`
      const newTextObject: TextObject = {
        id: newTextId,
        text: "",
        x,
        y,
        fontSize: textFontSize,
        color,
        isEditing: true,
      }
      setTextObjects([...textObjects, newTextObject])
      setSelectedTextId(newTextId)
      return
    }

    setIsDrawing(true)
    setStartPosition({ x, y })
    lastPositionRef.current = { x, y }

    if (tool === "pen" || tool === "eraser") {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color
      ctx.lineWidth = tool === "eraser" ? eraserSize : brushSize
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isMovingText && movingTextId) {
      const { x, y } = getCanvasCoordinates(e)

      // Update the position of the text being moved
      const updatedTextObjects = textObjects.map((textObj) => {
        if (textObj.id === movingTextId) {
          return {
            ...textObj,
            x: x - movingTextOffset.x,
            y: y - movingTextOffset.y,
          }
        }
        return textObj
      })

      setTextObjects(updatedTextObjects)
      return
    }

    if ((!isDrawing && !drawWithoutClick) || !ctx || !canvasRef.current) return

    const { x, y } = getCanvasCoordinates(e)

    if (drawWithoutClick && !isDrawing && tool !== "line" && tool !== "rectangle" && tool !== "circle") {
      // If we're in draw-without-click mode and the tool is appropriate
      if (!lastPositionRef.current) {
        lastPositionRef.current = { x, y }
        ctx.beginPath()
        ctx.moveTo(x, y)
      } else {
        // Draw a continuous line from the last position to the current position
        ctx.beginPath()
        ctx.moveTo(lastPositionRef.current.x, lastPositionRef.current.y)
        ctx.lineTo(x, y)
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
        ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color
        ctx.lineWidth = tool === "eraser" ? eraserSize : brushSize
        ctx.stroke()

        // Update last position
        lastPositionRef.current = { x, y }
      }

      // Save to history periodically
      if (Math.random() < 0.05) {
        // Save roughly every 20 moves to avoid too many history states
        saveToHistory()
      }
    } else if (isDrawing) {
      if (tool === "pen" || tool === "eraser") {
        // Draw a continuous line from the last position to the current position
        ctx.lineTo(x, y)
        ctx.stroke()
        lastPositionRef.current = { x, y }
      } else if (tool === "rectangle" || tool === "circle" || tool === "line") {
        // Preview shape by redrawing from history
        if (historyIndex >= 0) {
          ctx.putImageData(history[historyIndex], 0, 0)
          redrawCanvas()
        }

        ctx.beginPath()
        ctx.strokeStyle = color
        ctx.lineWidth = brushSize

        if (useFill && fillColor) {
          ctx.fillStyle = fillColor
        }

        if (tool === "rectangle") {
          const width = x - startPosition.x
          const height = y - startPosition.y
          ctx.rect(startPosition.x, startPosition.y, width, height)
          if (useFill && fillColor) {
            ctx.fill()
          }
          ctx.stroke()
        } else if (tool === "circle") {
          const radius = Math.sqrt(Math.pow(x - startPosition.x, 2) + Math.pow(y - startPosition.y, 2))
          ctx.arc(startPosition.x, startPosition.y, radius, 0, 2 * Math.PI)
          if (useFill && fillColor) {
            ctx.fill()
          }
          ctx.stroke()
        } else if (tool === "line") {
          ctx.moveTo(startPosition.x, startPosition.y)
          ctx.lineTo(x, y)
          ctx.lineCap = "round"
          ctx.stroke()
        }
      }
    }
  }

  const handlePointerUp = () => {
    if (isMovingText) {
      setIsMovingText(false)
      setMovingTextId(null)
      saveToHistory()
      return
    }

    if ((!isDrawing && !drawWithoutClick) || !ctx) return

    if (isDrawing) {
      setIsDrawing(false)

      if (tool !== "text") {
        saveToHistory()
      }
    }

    // Reset last position when lifting the pointer
    if (!drawWithoutClick) {
      lastPositionRef.current = null
    }
  }

  // Handle touch events for panning
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Two finger touch - for panning
      multiTouchRef.current = true

      if (touchTimeoutRef.current) {
        clearTimeout(touchTimeoutRef.current)
        touchTimeoutRef.current = null
      }

      const touch1 = e.touches[0]
      const touch2 = e.touches[1]

      // Calculate midpoint between the two touches
      const midX = (touch1.clientX + touch2.clientX) / 2
      const midY = (touch1.clientY + touch2.clientY) / 2

      lastPanPositionRef.current = { x: midX, y: midY }

      // Prevent drawing
      setIsDrawing(false)
      lastPositionRef.current = null
    } else if (e.touches.length === 1) {
      // Single finger touch - for drawing
      multiTouchRef.current = false

      // Set a timeout to determine if it's a tap or a draw
      if (touchTimeoutRef.current) {
        clearTimeout(touchTimeoutRef.current)
      }

      touchTimeoutRef.current = setTimeout(() => {
        touchStartRef.current = null
      }, 100)

      const touch = e.touches[0]
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
      }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (multiTouchRef.current && e.touches.length === 2) {
      // Handle panning with two fingers
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]

      // Calculate midpoint between the two touches
      const midX = (touch1.clientX + touch2.clientX) / 2
      const midY = (touch1.clientY + touch2.clientY) / 2

      if (lastPanPositionRef.current) {
        const deltaX = midX - lastPanPositionRef.current.x
        const deltaY = midY - lastPanPositionRef.current.y

        setPanOffset((prev) => ({
          x: prev.x + deltaX / scale,
          y: prev.y + deltaY / scale,
        }))

        lastPanPositionRef.current = { x: midX, y: midY }
      }

      e.preventDefault()
    }
  }

  const handleTouchEnd = () => {
    multiTouchRef.current = false
    lastPanPositionRef.current = null

    if (touchTimeoutRef.current) {
      clearTimeout(touchTimeoutRef.current)
      touchTimeoutRef.current = null
    }
  }

  // Handle text input
  const handleTextInput = (id: string, value: string) => {
    const updatedTextObjects = textObjects.map((textObj) => {
      if (textObj.id === id) {
        return {
          ...textObj,
          text: value,
        }
      }
      return textObj
    })
    setTextObjects(updatedTextObjects)
  }

  // Confirm text editing
  const confirmTextEdit = (id: string) => {
    const textObj = textObjects.find((t) => t.id === id)

    if (!textObj || !textObj.text.trim()) {
      // Remove empty text objects
      setTextObjects(textObjects.filter((t) => t.id !== id))
    } else {
      // Update the text object to not be in editing mode
      const updatedTextObjects = textObjects.map((textObj) => {
        if (textObj.id === id) {
          return {
            ...textObj,
            isEditing: false,
          }
        }
        return textObj
      })
      setTextObjects(updatedTextObjects)
    }

    setSelectedTextId(null)
    saveToHistory()
  }

  // Cancel text editing
  const cancelTextEdit = (id: string) => {
    const textObj = textObjects.find((t) => t.id === id)

    if (!textObj || !textObj.text.trim()) {
      // Remove empty text objects
      setTextObjects(textObjects.filter((t) => t.id !== id))
    } else {
      // Update the text object to not be in editing mode
      const updatedTextObjects = textObjects.map((textObj) => {
        if (textObj.id === id) {
          return {
            ...textObj,
            isEditing: false,
          }
        }
        return textObj
      })
      setTextObjects(updatedTextObjects)
    }

    setSelectedTextId(null)
  }

  // Update text font size
  const updateTextFontSize = (id: string, size: number) => {
    const updatedTextObjects = textObjects.map((textObj) => {
      if (textObj.id === id) {
        return {
          ...textObj,
          fontSize: size,
        }
      }
      return textObj
    })
    setTextObjects(updatedTextObjects)
  }

  // Update text color
  const updateTextColor = (id: string, newColor: string) => {
    const updatedTextObjects = textObjects.map((textObj) => {
      if (textObj.id === id) {
        return {
          ...textObj,
          color: newColor,
        }
      }
      return textObj
    })
    setTextObjects(updatedTextObjects)
  }

  return (
    <div
      className={cn(
        "flex flex-col bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300",
        isFullscreen ? "fixed inset-0 z-50" : "h-[70vh]",
      )}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-100 border-b">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className={cn(tool === "pen" && "bg-gray-200")}
            onClick={() => setTool("pen")}
            title="Pen"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={cn(tool === "eraser" && "bg-gray-200")}
            onClick={() => setTool("eraser")}
            title="Eraser"
          >
            <Eraser className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={cn(tool === "line" && "bg-gray-200")}
            onClick={() => setTool("line")}
            title="Straight Line"
          >
            <MinusIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={cn(tool === "rectangle" && "bg-gray-200")}
            onClick={() => setTool("rectangle")}
            title="Rectangle"
          >
            <Square className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={cn(tool === "circle" && "bg-gray-200")}
            onClick={() => setTool("circle")}
            title="Circle"
          >
            <Circle className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={cn(tool === "text" && "bg-gray-200")}
            onClick={() => setTool("text")}
            title="Text"
          >
            <Type className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={cn(tool === "select" && "bg-gray-200")}
            onClick={() => setTool("select")}
            title="Select/Move"
          >
            <Move className="h-4 w-4" />
          </Button>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" title="Color">
              <Palette className="h-4 w-4" />
              <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <Tabs defaultValue="stroke">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="stroke" className="flex-1">
                  Stroke Color
                </TabsTrigger>
                <TabsTrigger value="fill" className="flex-1">
                  Fill Color
                </TabsTrigger>
              </TabsList>

              <TabsContent value="stroke">
                <div className="grid grid-cols-5 gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      className={cn("w-8 h-8 rounded-full border", color === c && "ring-2 ring-gray-400")}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
                <div className="mt-2">
                  <Label htmlFor="custom-color">Custom:</Label>
                  <Input
                    id="custom-color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-8 w-full"
                  />
                </div>
              </TabsContent>

              <TabsContent value="fill">
                <div className="flex items-center space-x-2 mb-4">
                  <Switch id="use-fill" checked={useFill} onCheckedChange={setUseFill} />
                  <Label htmlFor="use-fill">Enable Fill</Label>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      className={cn("w-8 h-8 rounded-full border", fillColor === c && "ring-2 ring-gray-400")}
                      style={{ backgroundColor: c }}
                      onClick={() => setFillColor(c)}
                      disabled={!useFill}
                    />
                  ))}
                </div>
                <div className="mt-2">
                  <Label htmlFor="custom-fill-color">Custom:</Label>
                  <Input
                    id="custom-fill-color"
                    type="color"
                    value={fillColor}
                    onChange={(e) => setFillColor(e.target.value)}
                    className="h-8 w-full"
                    disabled={!useFill}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-2">
          <Minus className="h-4 w-4 text-gray-500" />
          <Slider
            value={[brushSize]}
            min={1}
            max={50}
            step={1}
            onValueChange={(value) => setBrushSize(value[0])}
            className="w-24"
          />
          <Plus className="h-4 w-4 text-gray-500" />
        </div>

        {tool === "eraser" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Eraser:</span>
            <Minus className="h-4 w-4 text-gray-500" />
            <Slider
              value={[eraserSize]}
              min={5}
              max={100}
              step={5}
              onValueChange={(value) => setEraserSize(value[0])}
              className="w-24"
            />
            <Plus className="h-4 w-4 text-gray-500" />
          </div>
        )}

        {tool === "text" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Font Size:</span>
            <Minus className="h-4 w-4 text-gray-500" />
            <Slider
              value={[textFontSize]}
              min={8}
              max={72}
              step={1}
              onValueChange={(value) => setTextFontSize(value[0])}
              className="w-24"
            />
            <Plus className="h-4 w-4 text-gray-500" />
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <div
            className={`text-xs px-2 py-1 rounded ${capsLockEnabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}
          >
            {capsLockEnabled ? "CAPS LOCK ON (Drawing Mode)" : "CAPS LOCK OFF"}
          </div>

          <Button variant="outline" size="icon" onClick={handleUndo} disabled={historyIndex <= 0} title="Undo">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleClear} title="Clear">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleDownload} title="Download">
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" title="Help">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>How to Use DrawMaster</DialogTitle>
                <DialogDescription>Quick guide to using this drawing tool</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium">Drawing Controls:</h3>
                  <ul className="list-disc pl-5 text-sm">
                    <li>
                      <strong>Caps Lock ON:</strong> Draw by simply moving one finger (no clicking needed)
                    </li>
                    <li>
                      <strong>Caps Lock OFF:</strong> Use one finger to draw (click and drag)
                    </li>
                    <li>
                      Use <strong>two fingers</strong> to pan/move around the canvas
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium">Tools:</h3>
                  <ul className="list-disc pl-5 text-sm">
                    <li>
                      <strong>Pen:</strong> Free-hand drawing with continuous lines
                    </li>
                    <li>
                      <strong>Eraser:</strong> Erase parts of your drawing
                    </li>
                    <li>
                      <strong>Straight Line:</strong> Draw straight lines between two points
                    </li>
                    <li>
                      <strong>Rectangle/Circle:</strong> Draw shapes (with optional fill)
                    </li>
                    <li>
                      <strong>Text:</strong> Add text directly on the canvas
                    </li>
                    <li>
                      <strong>Select/Move:</strong> Select and move text objects
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium">Text Tool:</h3>
                  <ul className="list-disc pl-5 text-sm">
                    <li>Click anywhere to place text</li>
                    <li>Type directly on the canvas</li>
                    <li>Click the checkmark to confirm or X to cancel</li>
                    <li>Use the Select tool to move text after placing it</li>
                    <li>Click on existing text to edit it</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium">Shape Filling:</h3>
                  <ul className="list-disc pl-5 text-sm">
                    <li>Click the color palette icon</li>
                    <li>Switch to the "Fill Color" tab</li>
                    <li>Enable fill and choose a color</li>
                    <li>Draw shapes with both outline and fill</li>
                  </ul>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative flex-grow overflow-hidden bg-white"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <motion.canvas
          ref={canvasRef}
          className="absolute touch-none"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
            transformOrigin: "0 0",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />

        {/* Text editing overlay */}
        <div
          ref={overlayRef}
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          {textObjects.map(
            (textObj) =>
              textObj.isEditing && (
                <div
                  key={textObj.id}
                  className="absolute pointer-events-auto"
                  style={{
                    left: `${textObj.x}px`,
                    top: `${textObj.y - textObj.fontSize}px`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="text"
                      value={textObj.text}
                      onChange={(e) => handleTextInput(textObj.id, e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm min-w-[100px]"
                      autoFocus
                      style={{
                        fontSize: `${textObj.fontSize}px`,
                        color: textObj.color,
                        height: `${textObj.fontSize + 10}px`,
                      }}
                      placeholder="Type here..."
                    />
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-6 w-6"
                        onClick={() => confirmTextEdit(textObj.id)}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-6 w-6"
                        onClick={() => cancelTextEdit(textObj.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-white p-1 rounded border shadow-sm">
                    <div className="flex items-center gap-1">
                      <Label htmlFor={`font-size-${textObj.id}`} className="text-xs">
                        Size:
                      </Label>
                      <Slider
                        id={`font-size-${textObj.id}`}
                        value={[textObj.fontSize]}
                        min={8}
                        max={72}
                        step={1}
                        onValueChange={(value) => updateTextFontSize(textObj.id, value[0])}
                        className="w-20"
                      />
                      <span className="text-xs">{textObj.fontSize}px</span>
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-6 px-2">
                          <Palette className="h-3 w-3 mr-1" />
                          <span className="text-xs">Color</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48">
                        <div className="grid grid-cols-5 gap-1">
                          {colors.map((c) => (
                            <button
                              key={c}
                              className={cn(
                                "w-6 h-6 rounded-full border",
                                textObj.color === c && "ring-2 ring-gray-400",
                              )}
                              style={{ backgroundColor: c }}
                              onClick={() => updateTextColor(textObj.id, c)}
                            />
                          ))}
                        </div>
                        <div className="mt-2">
                          <Input
                            type="color"
                            value={textObj.color}
                            onChange={(e) => updateTextColor(textObj.id, e.target.value)}
                            className="h-6 w-full"
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              ),
          )}
        </div>
      </div>
    </div>
  )
}
