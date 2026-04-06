// public/js/map/toolManager.js
(function () {
    const state = {
      activeTool: null, // ex: "countriesVisited", "countriesToVisit", "markers", ...
      listeners: new Set(),
    }
  
    function setActiveTool(toolName) {
      state.activeTool = toolName || null
      for (const cb of state.listeners) cb(state.activeTool)
    }
  
    function toggleTool(toolName) {
      setActiveTool(state.activeTool === toolName ? null : toolName)
    }
  
    function getActiveTool() {
      return state.activeTool
    }
  
    function onChange(cb) {
      state.listeners.add(cb)
      return () => state.listeners.delete(cb)
    }
  
    window.ToolManager = { setActiveTool, toggleTool, getActiveTool, onChange }
  })()