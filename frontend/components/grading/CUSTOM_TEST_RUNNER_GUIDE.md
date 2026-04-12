# Custom Test Runner - Enhanced Output Display

## Overview

The Custom Test Runner provides a robust way to test student submissions with custom input and view comprehensive output results.

## Features

### 1. **Input Modes** (Exclusive)

- **Stdin Mode**: Paste text input directly
  - Character count displayed
  - Input validation before running
  - Monospace font for readability

- **File Mode**: Upload input from a file
  - File size shown in bytes
  - One file at a time (exclusive mode)
  - File name displayed with clear button

### 2. **Error Handling**

The system validates:

- ✅ Submission is selected
- ✅ Input provided matches the selected mode
- ✅ Submission files can be loaded
- ✅ API request succeeds
- ✅ Toast notifications for all errors

### 3. **Result Display Sections**

When a test completes, you'll see:

#### Status Header

- ✅ **Test Passed** (green) or ❌ **Test Failed** (red)
- Compilation status indicator
- Visual status colors for quick identification

#### 📥 Input Section

- Shows exactly what was sent to the program
- Character/byte count
- Full input visible (scrollable if large)
- Color-coded for stdin mode (blue text)

#### 📤 Output Section

- Program stdout displayed
- Character count shown
- Monospace font for code output
- Dark background for contrast
- Scrollable for long outputs

#### ⚠️ Stderr Section

- Error messages displayed separately
- Red text on dark red background
- Only shown if errors occurred
- Helps identify compilation or runtime errors

#### 💬 Message Section

- Compilation status details
- General error messages
- Only shown when needed

### 4. **User Experience**

**Loading State**

```
🔄 Running... (with spinner)
```

**Disabled States**

- No input provided
- Wrong file type
- No submission selected
- Already running a test

**Clear Output Button**

- Removes the display
- Allows running another test
- Clean UI state

## Example Workflow

```
1. Select submission file(s)
   ↓
2. Choose input mode (Stdin or File)
   ↓
3. Provide input data
   ↓
4. Click "Run Custom Test"
   ↓
5. Loading animation shows while running
   ↓
6. Results display with:
   - Input you provided
   - Program output
   - Any errors
   - Status indicator
   ↓
7. Click "Clear Output" to run again
```

## Error Handling Examples

### No Input Provided

```
Error: "Please enter input for stdin mode"
```

### File Load Failure

```
Error: "Could not load any submission files to run test with"
```

### Compilation Error

```
Status: ❌ Test Failed
Compilation: Error
Stderr: [compilation error details]
```

### Runtime Error

```
Status: ❌ Test Failed
Output: [partial output before crash]
Stderr: [runtime error details]
```

### Successful Execution

```
Status: ✅ Test Passed
Output: [program output]
```

## Code Quality Improvements

### Robust Error Handling

- Try/catch blocks with informative messages
- File loading continues even if one file fails
- Graceful degradation instead of crashes
- Console logging for debugging

### Better User Feedback

- Toast notifications with emoji indicators
- Specific error messages (not generic)
- Clear status indication (passed/failed)
- Input validation before execution

### Enhanced Display

- Organized sections with clear headers
- Color-coded by output type (output=normal, stderr=red)
- Scrollable containers for long content
- Input visibility for test reproduction

## Technical Implementation

### State Management

```typescript
- isRunningCustomTest: boolean (loading state)
- customStdin: string (text input)
- customInputFiles: { name, content }[] (file input)
- customTestMode: 'stdin' | 'file' (exclusive)
- runResult: RunResult | null (output display)
```

### Validation

```typescript
✓ Input format validated
✓ File availability checked
✓ Submission files loaded safely
✓ API errors caught and reported
✓ Empty results handled gracefully
```

### Display Logic

```
if runResult && (stdout || stderr || message) && results.length === 0:
  - Show status header
  - Display input section
  - Display output section
  - Display error section
  - Show clear button
```

## UI Design

### Color Scheme

- **Success**: Green (#4ec9b0) on dark background (#0d2818)
- **Error**: Red (#f44747) on dark red background (#2d0000)
- **Normal Output**: Light gray (#d4d4d4) on dark blue (#1a1a2e)
- **Input**: Blue (#569cd6) on black (#0c0c0c)

### Typography

- Monospace font for code
- Small sizes (10-11px) for consistency
- Capital tracking for section headers
- Clear hierarchy with spacing

### Responsive

- Scrollable containers for long content
- Max-height constraints prevent UI overflow
- Proper word wrapping for long lines
- Touch-friendly button sizes

## Benefits

✅ **Clarity** - Users see exactly what happened
✅ **Robustness** - Works with edge cases gracefully  
✅ **Feedback** - Toast + display + colors inform user
✅ **Debugging** - Full input/output/error visibility
✅ **Professionalism** - Polished UI with proper styling
✅ **Flexibility** - Stdin or file input modes
✅ **Safety** - Defensive programming prevents crashes

## Future Enhancements

- [ ] Execution time display
- [ ] Memory usage stats
- [ ] Input/output diff comparison
- [ ] Save test result history
- [ ] Copy output to clipboard
- [ ] Multiple test batch execution
- [ ] Test result sharing
