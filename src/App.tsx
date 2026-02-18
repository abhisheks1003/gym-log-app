import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'

type SetEntry = {
  reps: number
  weight: number
}

type ExerciseEntry = {
  id: string
  name: string
  sets: SetEntry[]
}

type Workout = {
  id: string
  date: string
  workoutName: string
  exercises: ExerciseEntry[]
  createdAt: string
}

const STORAGE_KEY = 'gym-log-workouts-v1'

const createSet = (): SetEntry => ({ reps: 10, weight: 0 })
const createExercise = (): ExerciseEntry => ({ id: crypto.randomUUID(), name: '', sets: [createSet()] })

function loadWorkouts(): Workout[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Workout[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveWorkouts(items: Workout[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function sumWorkoutVolume(workout: Workout) {
  return workout.exercises.reduce(
    (total, ex) => total + ex.sets.reduce((s, set) => s + (set.reps || 0) * (set.weight || 0), 0),
    0,
  )
}

function sumWorkoutReps(workout: Workout) {
  return workout.exercises.reduce((total, ex) => total + ex.sets.reduce((s, set) => s + (set.reps || 0), 0), 0)
}

function App() {
  const [tab, setTab] = useState<'log' | 'history' | 'analytics'>('log')
  const [workouts, setWorkouts] = useState<Workout[]>(() => loadWorkouts())

  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [workoutName, setWorkoutName] = useState('')
  const [exercises, setExercises] = useState<ExerciseEntry[]>([createExercise()])

  const sortedWorkouts = useMemo(
    () => [...workouts].sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf()),
    [workouts],
  )

  const dashboard = useMemo(() => {
    const lineData = sortedWorkouts
      .slice()
      .reverse()
      .map((w) => ({
        date: dayjs(w.date).format('MMM D'),
        volume: sumWorkoutVolume(w),
        reps: sumWorkoutReps(w),
      }))

    const byExercise = new Map<string, { name: string; totalVolume: number; totalReps: number }>()

    for (const workout of workouts) {
      for (const ex of workout.exercises) {
        const key = ex.name.trim().toLowerCase()
        if (!key) continue

        const current = byExercise.get(key) || { name: ex.name.trim(), totalVolume: 0, totalReps: 0 }
        current.totalVolume += ex.sets.reduce((s, set) => s + (set.reps || 0) * (set.weight || 0), 0)
        current.totalReps += ex.sets.reduce((s, set) => s + (set.reps || 0), 0)
        byExercise.set(key, current)
      }
    }

    const exerciseBars = [...byExercise.values()]
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, 10)
      .map((x) => ({
        exercise: x.name,
        volume: x.totalVolume,
        reps: x.totalReps,
      }))

    return { lineData, exerciseBars }
  }, [workouts, sortedWorkouts])

  function updateExerciseName(exerciseId: string, name: string) {
    setExercises((prev) => prev.map((ex) => (ex.id === exerciseId ? { ...ex, name } : ex)))
  }

  function addExercise() {
    setExercises((prev) => [...prev, createExercise()])
  }

  function removeExercise(exerciseId: string) {
    setExercises((prev) => (prev.length === 1 ? prev : prev.filter((ex) => ex.id !== exerciseId)))
  }

  function addSet(exerciseId: string) {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === exerciseId ? { ...ex, sets: [...ex.sets, createSet()] } : ex)),
    )
  }

  function removeSet(exerciseId: string, setIndex: number) {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex
        if (ex.sets.length === 1) return ex
        return { ...ex, sets: ex.sets.filter((_, i) => i !== setIndex) }
      }),
    )
  }

  function updateSet(exerciseId: string, setIndex: number, field: 'reps' | 'weight', value: number) {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex
        const nextSets = ex.sets.map((set, i) => (i === setIndex ? { ...set, [field]: value } : set))
        return { ...ex, sets: nextSets }
      }),
    )
  }

  function handleSaveWorkout() {
    if (!workoutName.trim()) {
      alert('Please enter a workout name.')
      return
    }

    if (exercises.some((ex) => !ex.name.trim())) {
      alert('Please enter all exercise names.')
      return
    }

    const workout: Workout = {
      id: crypto.randomUUID(),
      date,
      workoutName: workoutName.trim(),
      exercises,
      createdAt: new Date().toISOString(),
    }

    const next = [workout, ...workouts]
    setWorkouts(next)
    saveWorkouts(next)

    setWorkoutName('')
    setDate(dayjs().format('YYYY-MM-DD'))
    setExercises([createExercise()])
    setTab('history')
  }

  function deleteWorkout(workoutId: string) {
    const next = workouts.filter((w) => w.id !== workoutId)
    setWorkouts(next)
    saveWorkouts(next)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Gym Tracker</p>
          <h1>Sets & Reps Log</h1>
        </div>
        <div className="tabs">
          <button className={tab === 'log' ? 'active' : ''} onClick={() => setTab('log')}>
            Log
          </button>
          <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
            History
          </button>
          <button className={tab === 'analytics' ? 'active' : ''} onClick={() => setTab('analytics')}>
            Analytics
          </button>
        </div>
      </header>

      {tab === 'log' && (
        <section className="panel">
          <h2>New Workout Session</h2>

          <div className="row">
            <label>
              Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label>
              Workout Name
              <input
                type="text"
                placeholder="Push Day / Legs / Pull"
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
              />
            </label>
          </div>

          {exercises.map((exercise, idx) => (
            <div key={exercise.id} className="exercise-card">
              <div className="exercise-title-row">
                <h3>Exercise {idx + 1}</h3>
                <button className="danger ghost" onClick={() => removeExercise(exercise.id)}>
                  Remove
                </button>
              </div>

              <input
                className="exercise-name"
                type="text"
                placeholder="e.g. Barbell Squat"
                value={exercise.name}
                onChange={(e) => updateExerciseName(exercise.id, e.target.value)}
              />

              <div className="set-grid header">
                <span>Set</span>
                <span>Reps</span>
                <span>Weight (kg)</span>
                <span />
              </div>

              {exercise.sets.map((set, setIndex) => (
                <div className="set-grid" key={`${exercise.id}-${setIndex}`}>
                  <span>{setIndex + 1}</span>
                  <input
                    type="number"
                    min={0}
                    value={set.reps}
                    onChange={(e) => updateSet(exercise.id, setIndex, 'reps', Number(e.target.value || 0))}
                  />
                  <input
                    type="number"
                    min={0}
                    value={set.weight}
                    onChange={(e) => updateSet(exercise.id, setIndex, 'weight', Number(e.target.value || 0))}
                  />
                  <button className="danger ghost" onClick={() => removeSet(exercise.id, setIndex)}>
                    ✕
                  </button>
                </div>
              ))}

              <button className="secondary" onClick={() => addSet(exercise.id)}>
                + Add Set
              </button>
            </div>
          ))}

          <div className="actions">
            <button className="secondary" onClick={addExercise}>
              + Add Exercise
            </button>
            <button className="primary" onClick={handleSaveWorkout}>
              Save Workout
            </button>
          </div>
        </section>
      )}

      {tab === 'history' && (
        <section className="panel">
          <h2>Workout History</h2>
          {sortedWorkouts.length === 0 ? (
            <p className="muted">No workouts logged yet.</p>
          ) : (
            sortedWorkouts.map((workout) => (
              <article key={workout.id} className="history-card">
                <div className="history-head">
                  <div>
                    <h3>{workout.workoutName}</h3>
                    <p className="muted">{dayjs(workout.date).format('ddd, MMM D, YYYY')}</p>
                  </div>
                  <button className="danger ghost" onClick={() => deleteWorkout(workout.id)}>
                    Delete
                  </button>
                </div>

                {workout.exercises.map((ex) => (
                  <div key={ex.id} className="history-exercise">
                    <strong>{ex.name}</strong>
                    <ul>
                      {ex.sets.map((set, i) => (
                        <li key={`${ex.id}-${i}`}>
                          Set {i + 1}: {set.reps} reps × {set.weight} kg
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </article>
            ))
          )}
        </section>
      )}

      {tab === 'analytics' && (
        <section className="panel">
          <h2>Progress Dashboard</h2>
          {workouts.length < 1 ? (
            <p className="muted">Log workouts to see analytics.</p>
          ) : (
            <>
              <div className="chart-card">
                <h3>Total Volume Over Time</h3>
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={dashboard.lineData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="volume" stroke="#0ea5e9" strokeWidth={2} name="Volume" />
                      <Line type="monotone" dataKey="reps" stroke="#22c55e" strokeWidth={2} name="Total Reps" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="chart-card">
                <h3>Top Exercises by Volume</h3>
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dashboard.exerciseBars}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="exercise" hide={dashboard.exerciseBars.length > 6} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="volume" fill="#0ea5e9" name="Volume" />
                      <Bar dataKey="reps" fill="#22c55e" name="Reps" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}

export default App
