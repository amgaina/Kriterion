/\*\*

- GradingPageContent Integration Guide
-
- This document shows where to integrate GradingEnhancements components
- into the existing GradingPageContent.tsx file
  \*/

// ============================================================================
// 1. ADD IMPORTS (at the top of GradingPageContent.tsx)
// ============================================================================

import {
RubricGrader,
TestDataCreator,
TerminalInputComponent,
} from './GradingEnhancements';

// ============================================================================
// 2. ADD STATE VARIABLES (in the GradingPageContent component)
// ============================================================================

// Add after existing state declarations:

// Rubric grading state
const [rubricScores, setRubricScores] = useState<Record<number, number>>({});

// Handler for rubric score changes
const handleRubricScoreChange = (itemId: number, score: number) => {
setRubricScores((prev) => ({
...prev,
[itemId]: score,
}));
};

// Handler for total rubric score changes (updates grand total)
const handleRubricTotalChange = (total: number) => {
setGradeState((prev) => ({
...prev,
finalScore: total.toString(),
}));
};

// ============================================================================
// 3. ENHANCE TERMINAL LAYOUT - Reorder input to top
// ============================================================================

// In the renderAct where OUTPUT tab content is rendered, REPLACE:
// <div className="flex flex-col flex-1 min-h-0 bg-[#0c0c0c] overflow-y-auto">
// ... with ...

<TerminalInputComponent
    isRunning={interactiveRunning}
    onSubmit={sendInteractiveStdin}
    output={interactiveOutput}
    outputEndRef={interactiveOutputEndRef}
/>

// ============================================================================
// 4. MAKE TEST RESULTS SCROLLABLE - Replace RUN RESULTS tab content
// ============================================================================

// In the 'tests' activePanel section, add overflow-y-auto:

{activePanel === 'tests' && (
<div className="overflow-y-auto">
{runResult && runResult.results.length > 0 ? (
<div className="space-y-2">
{/_ existing content _/}
</div>
) : (
<div className="text-center py-6 text-[#858585]">
<Target className="w-8 h-8 mx-auto text-[#505050] mb-2" />
<p className="text-[12px]">Run the code to see test results</p>
</div>
)}
</div>
)}

// ============================================================================
// 5. ADD RUBRIC GRADER TO GRADING TAB
// ============================================================================

// In the grading panel right panel section, add AFTER the Score Summary:

{assignment.rubric && assignment.rubric.items?.length > 0 && (
<div className="border-t border-[#3c3c3c] pt-4 mt-4">
<RubricGrader
rubricItems={assignment.rubric.items.map((item, idx) => ({
itemId: item.id,
name: item.name,
description: item.description,
weight: item.weight,
maxPoints: item.points,
earnedPoints: rubricScores[item.id] ?? 0,
}))}
mode={/_ determine from assignment _/}
maxScore={assignment.max_score}
onScoreChange={handleRubricScoreChange}
onTotalScoreChange={handleRubricTotalChange}
/>
</div>
)}

// ============================================================================
// 6. ADD TEST DATA CREATOR TO TESTS TAB
// ============================================================================

// In the tests panel (right panel), add BEFORE the test case list:

<div className="mb-4">
    <TestDataCreator
        assignmentId={assignmentId}
        onTestCaseAdded={async (testCase) => {
            // Send to backend to create test case
            try {
                await apiClient.createTestCase(assignmentId, testCase);
                // Refresh assignment data
                await queryClient.invalidateQueries({ 
                    queryKey: ['assignment', assignmentId] 
                });
                toast({
                    title: 'Test Case Added',
                    description: 'New test case created successfully.',
                });
            } catch (err) {
                toast({
                    title: 'Error',
                    description: 'Failed to create test case.',
                    variant: 'destructive',
                });
            }
        }}
    />
</div>

// ============================================================================
// 7. KEY STYLING IMPROVEMENTS
// ============================================================================

// Apply these CSS utilities throughout:

// Dark theme colors (already in use):
// - Background: #1e1e1e, #252526, #0c0c0c
// - Borders: #3c3c3c
// - Text: #cccccc, #d4d4d4, #858585
// - Accent: #862733
// - Success: #4ec9b0

// New interactive elements should use:
// hover:bg-[#2a2d2e] // Hover background
// focus:ring-2 focus:ring-[#862733] // Focus ring
// focus:border-[#862733] // Focus border
// transition-colors // Smooth transitions
// disabled:opacity-50 // Disabled state

// ============================================================================
// 8. CALCULATE RUBRIC TOTAL (Helper function)
// ============================================================================

const calculateRubricTotal = (
rubricItems: RubricItemFlat[],
scores: Record<number, number>,
mode: 'weight' | 'points',
maxScore: number
): number => {
if (mode === 'points') {
return rubricItems.reduce((sum, item) => sum + (scores[item.id] ?? 0), 0);
} else {
return rubricItems.reduce((sum, item) => {
const percentage = item.points > 0
? (scores[item.id] ?? 0) / item.points
: 0;
return sum + ((item.weight / 100) _ maxScore _ percentage);
}, 0);
}
};

// ============================================================================
// 9. INTEGRATION TESTING CHECKLIST
// ============================================================================

// After integration, test these features:

// ✓ Terminal input box appears at top of terminal output
// ✓ Can type input and press Enter when running program
// ✓ Test results tab scrolls independently
// ✓ Rubric items display in grading tab
// ✓ Can edit rubric scores and see total update
// ✓ Can add new test cases from grading view
// ✓ New test cases appear in test list
// ✓ Dark theme colors are consistent
// ✓ All buttons and inputs have proper focus states
// ✓ Scrollable areas work smoothly

// ============================================================================
// 10. API METHODS NEEDED (add to apiClient)
// ============================================================================

// createTestCase(assignmentId: number, testCase: any): Promise<any>
// This should POST to: /api/assignments/{assignmentId}/test-cases
// Body should include: name, description, input_type, input_data,
// expected_output, is_hidden, etc.

// ============================================================================
