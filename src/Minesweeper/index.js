import React, { useReducer, useEffect, useState } from 'react';
import sampleSize from 'lodash.samplesize';

import { Config } from './config';
import MinesweeperView from './MinesweeperView';

// state: {
//   difficulty: 'Beginner' || 'Intermediate' || 'Expert',
//   status: 'new' || 'started' || 'died' || 'won',
//   rows: Number,
//   columns: Number,
//   mines: Number,
//   ceils: Array {
//     state: 'cover' || 'flag' || 'unknown' || 'open' || 'die' || 'misflagged',
//     minesAround: Number (negative for mine itself),
//     opening: true || false
//   }
// }
const Clue = [
  103,104,105,106,107,109,113,115,121,122,123,124,125,127,128,129,130,133,137,139,143,153,159,163,165,171,177,181,183,187,189,190,192,193,203,209,213,215,221,227,231,233,237,239,240,242,243,253,259,263,265,271,277,281,283,287,289,290,292,293,303,309,313,315,321,327,331,333,337,339,341,343,353,354,355,359,363,365,371,377,378,379,380,383,387,389,391,393,403,409,413,415,421,427,428,433,437,439,441,443,453,459,463,465,471,477,479,483,487,489,493,503,509,513,515,521,527,529,533,537,539,543,553,559,563,565,571,577,579,583,587,589,593,603,609,613,615,621,627,630,633,637,639,643,653,659,663,665,671,677,680,683,687,689,693,703,709,713,715,721,727,730,733,737,739,743,753,759,760,761,762,763,765,766,767,768,769,771,772,773,774,775,777,781,783,784,785,786,787,789,793,
];


function getInitState(difficulty = 'Fulcrum') {
  return {
    difficulty,
    status: 'new',
    ...genGameConfig(Config[difficulty], difficulty),
  };
}

function reducer(state, action = {}) {
  switch (action.type) {
    case 'CLEAR_MAP':
      const difficulty = action.payload || state.difficulty;
      return getInitState(difficulty);
    case 'START_GAME':
      const exclude = action.payload;
      return {
        ...state,
        ...insertMines({ ...Config[state.difficulty], exclude }, state.ceils, state.difficulty),
        status: 'started',
      };
    case 'OPEN_CEIL': {
      const indexes = autoCeils(state, action.payload);
      const ceils = [...state.ceils];
      indexes.forEach(i => {
        const ceil = ceils[i];
        ceils[i] = { ...ceil, state: 'open' };
      });
      return {
        ...state,
        ceils,
      };
    }
    case 'CHANGE_CEIL_STATE': {
      const index = action.payload;
      const ceils = [...state.ceils];
      const ceil = state.ceils[index];
      let newState;
      switch (ceil.state) {
        case 'cover':
          newState = 'flag';
          break;
        case 'flag':
          newState = 'unknown';
          break;
        case 'unknown':
          newState = 'cover';
          break;
        default:
          throw new Error(`Unknown ceil state ${ceil.state}`);
      }
      ceils[index] = { ...ceil, state: newState };
      return {
        ...state,
        ceils,
      };
    }
    case 'GAME_OVER': {
      if (state.difficulty === 'Fulcrum') {
        const ceils = state.ceils.map(ceil => {
          return {
            ...ceil,
            state: 'misflagged'
          };
        })
        ceils[action.payload].state = 'die';
        return {
          ...state,
          status: 'died',
          ceils
        };
      }
      else {
        const ceils = state.ceils.map(ceil => {
          if (ceil.minesAround < 0 && ceil.state !== 'flag') {
            return {
              ...ceil,
              state: 'mine',
            };
          } else if (ceil.state === 'flag' && ceil.minesAround >= 0) {
            return {
              ...ceil,
              state: 'misflagged',
            };
          } else {
            return {
              ...ceil,
              opening: false,
            };
          }
        });
        ceils[action.payload].state = 'die';
        return {
          ...state,
          status: 'died',
          ceils,
        };
      }
    }
    case 'WON': {
      const ceils = state.ceils.map(ceil => {
        if (ceil.minesAround >= 0) {
          return {
            ...ceil,
            state: 'open',
          };
        } else {
          return {
            ...ceil,
            state: 'flag',
          };
        }
      });
      return {
        ...state,
        status: 'won',
        ceils,
      };
    }
    case 'OPENING_CEIL': {
      const ceil = state.ceils[action.payload];
      const ceils = state.ceils.map(ceil => ({
        ...ceil,
        opening: false,
      }));
      ceils[action.payload] = { ...ceil, opening: true };
      return {
        ...state,
        ceils,
      };
    }
    case 'OPENING_CEILS': {
      const indexes = getNearIndexes(action.payload, state.rows, state.columns);
      const ceils = state.ceils.map(ceil => ({
        ...ceil,
        opening: false,
      }));
      [...indexes, action.payload].forEach(index => {
        const ceil = { ...ceils[index] };
        ceil.opening = true;
        ceils[index] = ceil;
      });
      return {
        ...state,
        ceils,
      };
    }
    default:
      return state;
  }
}

function MineSweeper({
  defaultDifficulty,
  onClose,
  sameTouchPos,
  lastTouch,
  platform,
}) {
  const [state, dispatch] = useReducer(
    reducer,
    getInitState(defaultDifficulty),
  );
  const seconds = useTimer(state.status);
  function changeCeilState(index) {
    const ceil = state.ceils[index];
    if (ceil.state === 'open' || ['won', 'died'].includes(state.status)) return;
    dispatch({ type: 'CHANGE_CEIL_STATE', payload: index });
  }
  function openCeil(index) {
    switch (state.status) {
      case 'new':
        dispatch({ type: 'START_GAME', payload: index });
        dispatch({ type: 'OPEN_CEIL', payload: index });
        break;
      case 'started':
        const ceil = state.ceils[index];
        if (['flag', 'open'].includes(ceil.state)) {
          break;
        } else if (ceil.minesAround < 0) {
          dispatch({ type: 'GAME_OVER', payload: index });
        } else {
          dispatch({ type: 'OPEN_CEIL', payload: index });
        }
        break;
      default:
        console.log(state.status);
    }
  }
  function openCeils(index) {
    const ceil = state.ceils[index];
    if (
      ceil.state !== 'open' ||
      ceil.minesAround <= 0 ||
      state.status !== 'started'
    )
      return;
    const indexes = getNearIndexes(index, state.rows, state.columns);
    const nearCeils = indexes.map(i => state.ceils[i]);
    if (
      nearCeils.filter(ceil => ceil.state === 'flag').length !==
      ceil.minesAround
    )
      return;
    const mineIndex = indexes.find(
      i => state.ceils[i].minesAround < 0 && state.ceils[i].state !== 'flag',
    );
    if (mineIndex) {
      dispatch({ type: 'GAME_OVER', payload: mineIndex });
    } else {
      indexes.forEach(i => dispatch({ type: 'OPEN_CEIL', payload: i }));
    }
  }
  useEffect(() => {
    if (state.status === 'started' && checkRemains() === 0) {
      dispatch({ type: 'WON' });
    }
  });
  function onReset(difficulty) {
    dispatch({ type: 'CLEAR_MAP', payload: difficulty });
  }
  function checkRemains() {
    const safeCeils = state.ceils
      .filter(ceil => ceil.state !== 'open')
      .filter(ceil => ceil.minesAround >= 0);
    return safeCeils.length;
  }
  function openingCeil(index) {
    if (['died', 'won'].includes(state.status)) return;
    dispatch({ type: 'OPENING_CEIL', payload: index });
  }
  function openingCeils(index) {
    if (['died', 'won'].includes(state.status)) return;
    dispatch({ type: 'OPENING_CEILS', payload: index });
  }
  return (
    <MinesweeperView
      {...state}
      onClose={onClose}
      changeCeilState={changeCeilState}
      openCeil={openCeil}
      openCeils={openCeils}
      onReset={onReset}
      seconds={seconds}
      openingCeil={openingCeil}
      openingCeils={openingCeils}
      sameTouchPos={sameTouchPos}
      lastTouch={lastTouch}
      platform={platform}
    />
  );
}

function genGameConfig(config, difficulty) {
  const { rows, columns, mines } = config;
  const ceils = Array(rows * columns)
    .fill()
    .map(_ => ({
      state: 'cover',
      minesAround: 0,
      opening: false,
    }));
  return {
    rows,
    columns,
    ceils,
    mines: difficulty === 'Fulcrum' ? Clue.length : mines,
  };
}




function insertMines(config, originCeils, difficulty) {
  const { rows, columns, mines, exclude } = config;
  const ceils = originCeils.map(ceil => ({ ...ceil }));
  if (rows * columns !== ceils.length)
    throw new Error('rows and columns not equal to ceils');
  const indexArray = [...Array(rows * columns).keys()];
  let mineCells = [];
  if (difficulty === 'Fulcrum') {
    mineCells = Clue;
  } else {
    mineCells = sampleSize(indexArray.filter(i => i !== exclude), mines);
  }
  console.log(mineCells)
  mineCells.forEach(chosen => {
    ceils[chosen].minesAround = -10;
    getNearIndexes(chosen, rows, columns).forEach(nearIndex => {
      ceils[nearIndex].minesAround += 1;
    });
  });
  return {
    rows,
    columns,
    ceils,
    mines,
  };
}

function autoCeils(state, index) {
  const { rows, columns } = state;
  const ceils = state.ceils.map(ceil => ({
    ...ceil,
    walked: false,
  }));
  return walkCeils(index);
  function walkCeils(index) {
    const ceil = ceils[index];
    if (ceil.walked || ceil.minesAround < 0 || ceil.state === 'flag') return [];
    ceil.walked = true;
    if (ceil.minesAround > 0) return [index];
    return [
      index,
      ...getNearIndexes(index, rows, columns).reduce(
        (lastIndexes, ceilIndex) => {
          return [...lastIndexes, ...walkCeils(ceilIndex)];
        },
        [],
      ),
    ];
  }
}

function getNearIndexes(index, rows, columns) {
  if (index < 0 || index >= rows * columns) return [];
  const row = Math.floor(index / columns);
  const column = index % columns;
  return [
    index - columns - 1,
    index - columns,
    index - columns + 1,
    index - 1,
    index + 1,
    index + columns - 1,
    index + columns,
    index + columns + 1,
  ].filter((_, arrayIndex) => {
    if (row === 0 && arrayIndex < 3) return false;
    if (row === rows - 1 && arrayIndex > 4) return false;
    if (column === 0 && [0, 3, 5].includes(arrayIndex)) return false;
    if (column === columns - 1 && [2, 4, 7].includes(arrayIndex)) return false;
    return true;
  });
}

function useTimer(status) {
  const [seconds, setSeconds] = useState(0);
  function addSecond() {
    setSeconds(sec => sec + 1);
  }
  useEffect(() => {
    let timer;
    switch (status) {
      case 'started':
        timer = setInterval(addSecond, 1000);
        break;
      case 'new':
        setSeconds(0);
        break;
      default:
        break;
    }
    return () => clearInterval(timer);
  }, [status]);
  return seconds;
}

export default MineSweeper;
