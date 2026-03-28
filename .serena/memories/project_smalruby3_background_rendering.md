# Smalruby3 Gem - Background Image Rendering Investigation

## Summary
Investigation of how background images (backdrops/costumes) are currently managed and rendered in the smalruby3 gem, with findings about why the current implementation only clears to white.

## Key Findings

### 1. Stage Background Management (ruby/smalruby3/lib/smalruby3/stage.rb)

**Current Implementation:**
- Stage inherits from Target
- Maintains `@backdrops` array of Costume objects
- Tracks `@current_backdrop` (index into backdrops array)
- Provides `switch_backdrop(name)` method that triggers `:backdrop_switches` hat blocks
- Default backdrop if none specified: white 2x2 PNG from preset (`backdrop-white-2x2.png`)
- Rotation center set to (240, 180) for backdrops

**Key Methods:**
- `backdrop_number` - returns 1-indexed backdrop number
- `backdrop_name` - returns name of current backdrop
- `switch_backdrop(name)` - changes backdrop and fires hat events
- `switch_backdrop_and_wait(name)` - changes backdrop and yields to allow script propagation
- `next_backdrop` - cycles to next backdrop

### 2. Costume Management (ruby/smalruby3/lib/smalruby3/costume.rb)

**Structure:**
- Name, path, rotation_center_x, rotation_center_y, bitmap_resolution
- Lazily loads surface via SDL2::Surface.load(@path)
- Provides display_width/height accounting for bitmap_resolution (2x assets display at 50%)

**Surface Handling:**
- Uses SDL2 for surface loading (PNG, BMP formats supported)
- Silhouette created for collision detection

### 3. Renderer Implementation (ruby/smalruby3/lib/smalruby3/render/renderer.rb)

**Current draw_stage Implementation (lines 92-94):**
```ruby
def draw_stage(_stage)
  # Stage background is white (already cleared to white in begin_frame)
end
```

**Why it's empty:**
- `begin_frame` already clears SDL renderer to white (line 84-85):
  ```ruby
  @sdl_renderer.draw_color = [255, 255, 255, 255]
  @sdl_renderer.clear
  ```
- The method does nothing because the white clear is considered sufficient
- NO actual backdrop costume is rendered

**Rendering Pipeline:**
1. `renderer.begin_frame` - clears to white (255,255,255,255)
2. `renderer.draw_stage(@stage)` - currently empty
3. `renderer.draw_sprite(s)` for each visible sprite
4. `renderer.end_frame` - presents frame

### 4. Coordinate System & Stage Dimensions

**Stage Dimensions:**
- STAGE_WIDTH = 480 pixels
- STAGE_HEIGHT = 360 pixels
- Scratch coordinate system: X range -240 to +240, Y range -180 to +180 (center origin)
- SDL2 coordinate system: top-left origin, +Y down

**Backdrop Rotation Center Convention:**
- For full-stage (480x360) backdrops: rotation_center_x=240, rotation_center_y=180
- Maps to physical center of 480x360 image (half-width, half-height)
- This is center-of-image registration, matching Scratch standard

**Key Transform Details (from draw_sprite - lines 103-128):**
- bitmap_resolution: scale factor (2 = 2x image, display at half size)
- display_width = costume.width / bitmap_resolution
- display_height = costume.height / bitmap_resolution
- Scale = sprite.size / 100.0 (size property, currently not used for stage)
- screen_x = (WIDTH/2 + sprite.x - cx * scale).to_i
- screen_y = (HEIGHT/2 - sprite.y - cy * scale).to_i
  - Note: SDL Y is inverted (sprite.y negated to convert from Scratch to SDL)
- Angle = sprite.direction - 90 (direction conversion)

### 5. Scratch-VM & Scratch-Render Backdrop System

**In Scratch-VM (packages/scratch-vm/src/sprites/rendered-target.js):**
- Stage is a rendered-target with isStage=true
- Uses `sprite.costumes` array (called "backdrops" for stage)
- `currentCostume` property tracks index (integer)
- `setCostume(index)` updates currentCostume and notifies renderer
- Backdrop changes trigger costume update via updateDrawableSkinId

**In Scratch-Render (packages/scratch-render/src/RenderWebGL.js):**
- Stage is treated as a drawable with a skin
- Backdrop is rendered as first item in _drawList
- Uses WebGL with projection matrix
- Supports effects like ghost (opacity modulation)
- Drawable system manages layer ordering (stage at bottom, sprites on top)

**Key Difference:**
- Scratch-render: Stage backdrop is rendered through drawable system (with effects, layering support)
- Smalruby3-render: Stage backdrop currently NOT rendered (only white clear)

### 6. Current Flow in Smalruby3

```
Runtime.run()
  -> init_targets()  [creates Stage instance]
  -> init_renderer()  [creates Renderer with SDL2]
  -> main_loop()
       -> render()
            -> @renderer.begin_frame  [clear white]
            -> @renderer.draw_stage(@stage)  [CURRENTLY EMPTY - SHOULD DRAW BACKDROP]
            -> pen_skin.render_to()
            -> @sprites.each { draw_sprite }
            -> @renderer.end_frame
```

### 7. Switch Backdrop Event Handling

**Implementation (stage.rb lines 44-49):**
```ruby
def switch_backdrop(name)
  idx = @backdrops.index { |b| b.name == name.to_s }
  if idx
    @current_backdrop = idx
    @runtime.start_hats(:backdrop_switches, name.to_s)
  end
end
```

**How it works:**
- Finds backdrop by name in @backdrops array
- Updates @current_backdrop index
- Triggers `:backdrop_switches` hat event via runtime
- Hat blocks listen for `when_backdrop_switches(name) { ... }`

**Note:** There's NO automatic rendering update - rely on next frame to see change (and currently frame only clears white)

## What Needs to be Implemented

For background image rendering to work:

1. **Modify draw_stage method** to:
   - Get current backdrop costume from `stage.backdrops[stage.current_backdrop]`
   - Load texture from costume.surface
   - Calculate display position/size (accounting for bitmap_resolution)
   - Render as full-screen sprite with rotation_center at (240, 180)

2. **Considerations for implementation:**
   - Backdrops don't have position/scale/rotation (always full stage size)
   - Must respect bitmap_resolution for 2x assets
   - Should support SVG and PNG formats
   - No effects applied (unlike sprites)
   - Must render BEFORE sprites (in draw order)

3. **Alternative approach:**
   - Could treat stage as special sprite internally
   - Render like sprites but with fixed position/size
   - Would allow effect support if needed

## Files Involved

**Smalruby3 gem:**
- `ruby/smalruby3/lib/smalruby3/stage.rb` - stage management, backdrop storage
- `ruby/smalruby3/lib/smalruby3/costume.rb` - costume/backdrop data
- `ruby/smalruby3/lib/smalruby3/render/renderer.rb` - renderer, draw_stage method (MAIN)
- `ruby/smalruby3/lib/smalruby3/runtime.rb` - main loop, render pipeline

**For reference (Scratch implementations):**
- `packages/scratch-vm/src/sprites/rendered-target.js` - how scratch-vm handles stage
- `packages/scratch-render/src/RenderWebGL.js` - how scratch-render draws stage backdrops
