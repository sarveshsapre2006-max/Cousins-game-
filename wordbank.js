/**
 * wordbank.js
 * Small Indian-flavoured example lists used only for placeholder hints
 * shown in the input boxes (e.g. "e.g. Mumbai"). They are NOT used to
 * validate answers - any answer starting with the right letter is accepted,
 * so players can be as creative as they like.
 */

const EXAMPLES = {
  Name: {
    A: 'Aditya', B: 'Bhavya', C: 'Chetan', D: 'Divya', E: 'Esha', F: 'Faisal',
    G: 'Gaurav', H: 'Harsha', I: 'Ishaan', J: 'Jyoti', K: 'Kavya', L: 'Lakshmi',
    M: 'Meera', N: 'Nikhil', O: 'Om', P: 'Priya', Q: 'Qasim', R: 'Rahul',
    S: 'Sanya', T: 'Tanvi', U: 'Uday', V: 'Vikram', W: 'Waseem', X: 'Xitij',
    Y: 'Yash', Z: 'Zara'
  },
  Country: {
    A: 'Australia', B: 'Bhutan', C: 'Canada', D: 'Denmark', E: 'Egypt', F: 'France',
    G: 'Germany', H: 'Hungary', I: 'India', J: 'Japan', K: 'Kenya', L: 'Laos',
    M: 'Malaysia', N: 'Nepal', O: 'Oman', P: 'Portugal', Q: 'Qatar', R: 'Russia',
    S: 'Spain', T: 'Thailand', U: 'Uganda', V: 'Vietnam', W: 'Wales', X: 'Xanadu',
    Y: 'Yemen', Z: 'Zambia'
  },
  City: {
    A: 'Agra', B: 'Bengaluru', C: 'Chennai', D: 'Delhi', E: 'Erode', F: 'Faridabad',
    G: 'Guwahati', H: 'Hyderabad', I: 'Indore', J: 'Jaipur', K: 'Kolkata', L: 'Lucknow',
    M: 'Mumbai', N: 'Nagpur', O: 'Ooty', P: 'Pune', Q: 'Quilon', R: 'Ranchi',
    S: 'Surat', T: 'Thane', U: 'Udaipur', V: 'Vadodara', W: 'Warangal', X: 'Xicom',
    Y: 'Yavatmal', Z: 'Zirakpur'
  },
  Object: {
    A: 'Almirah', B: 'Bucket', C: 'Chair', D: 'Diya', E: 'Eraser', F: 'Fan',
    G: 'Glass', H: 'Hammer', I: 'Iron', J: 'Jug', K: 'Kettle', L: 'Lamp',
    M: 'Mirror', N: 'Napkin', O: 'Oven', P: 'Pen', Q: 'Quilt', R: 'Ring',
    S: 'Spoon', T: 'Table', U: 'Umbrella', V: 'Vase', W: 'Watch', X: 'Xylophone',
    Y: 'Yarn', Z: 'Zipper'
  },
  Animal: {
    A: 'Ant', B: 'Buffalo', C: 'Camel', D: 'Deer', E: 'Elephant', F: 'Fox',
    G: 'Goat', H: 'Horse', I: 'Iguana', J: 'Jackal', K: 'Kangaroo', L: 'Lion',
    M: 'Monkey', N: 'Nightingale', O: 'Ostrich', P: 'Peacock', Q: 'Quail', R: 'Rabbit',
    S: 'Snake', T: 'Tiger', U: 'Urial', V: 'Vulture', W: 'Wolf', X: 'X-ray fish',
    Y: 'Yak', Z: 'Zebra'
  },
  Surname: {
    A: 'Agarwal', B: 'Bhatt', C: 'Chauhan', D: 'Deshmukh', E: 'Elangovan', F: 'Fernandes',
    G: 'Gupta', H: 'Hegde', I: 'Iyer', J: 'Joshi', K: 'Kulkarni', L: 'Luthra',
    M: 'Mehta', N: 'Nair', O: 'Oberoi', P: 'Patel', Q: 'Qureshi', R: 'Reddy',
    S: 'Sharma', T: 'Thakur', U: 'Upadhyay', V: 'Verma', W: 'Wagle', X: 'Xavier',
    Y: 'Yadav', Z: 'Zaveri'
  }
};

function getExample(category, letter) {
  const table = EXAMPLES[category];
  if (!table) return '';
  return table[letter.toUpperCase()] || '';
}

module.exports = { EXAMPLES, getExample };
