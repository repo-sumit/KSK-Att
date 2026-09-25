/**
 * Demo master data — student rosters. Electrician Shift 1 · Unit 2 (the main
 * demo batch) keeps the approved prototype's names exactly; every other batch
 * gets its own deterministic roster of realistic Maharashtrian names.
 */
import type { Student } from '@/domain/entities';
import { createRandom } from '@/lib/prng';
import { BATCHES, BATCH_SIZES } from './trades';

/** Name + father's name pairs from the approved prototype. */
const PROTOTYPE_ROSTER: ReadonlyArray<readonly [string, string]> = [
  ['Aarav Pawar', 'Sachin Pawar'], ['Aditi Joshi', 'Nitin Joshi'], ['Akash Gaikwad', 'Dattatray Gaikwad'], ['Amit Kumar', 'Ramesh Kumar'],
  ['Aniket Bhosale', 'Dnyaneshwar Bhosale'], ['Ankita Salunkhe', 'Prakash Salunkhe'], ['Chetan Mane', 'Vilas Mane'], ['Deepak Kale', 'Ashok Kale'],
  ['Gaurav Chavan', 'Sunil Chavan'], ['Harshal Patil', 'Rajendra Patil'], ['Ishwar Thorat', 'Balasaheb Thorat'], ['Kavita Deshpande', 'Mohan Deshpande'],
  ['Kiran Wagh', 'Santosh Wagh'], ['Mahesh Kadam', 'Vijay Kadam'], ['Neha Shinde', 'Anil Shinde'], ['Nikhil More', 'Ganesh More'],
  ['Omkar Jagtap', 'Shivaji Jagtap'], ['Pooja Kamble', 'Ravindra Kamble'], ['Pranav Deshmukh', 'Uday Deshmukh'], ['Priya Sharma', 'Rakesh Sharma'],
  ['Rahul Kumar', 'Suresh Kumar'], ['Rohit Sawant', 'Mahadev Sawant'], ['Sagar Nikam', 'Bhimrao Nikam'], ['Sakshi Ghorpade', 'Dilip Ghorpade'],
  ['Sanket Bhagat', 'Ramdas Bhagat'], ['Shubham Lokhande', 'Arun Lokhande'], ['Siddharth Waghmare', 'Kishor Waghmare'], ['Snehal Gore', 'Pandurang Gore'],
  ['Swapnil Dhumal', 'Namdev Dhumal'], ['Tushar Yadav', 'Hanumant Yadav'], ['Vaishnavi Pingale', 'Sanjay Pingale'], ['Yash Kulkarni', 'Milind Kulkarni'],
];

const MALE = [
  'Aarav', 'Abhishek', 'Aditya', 'Ajay', 'Akash', 'Amol', 'Aniket', 'Atharva', 'Chetan', 'Deepak', 'Dhiraj', 'Ganesh', 'Gaurav', 'Harshal',
  'Kunal', 'Mahesh', 'Mayur', 'Nikhil', 'Omkar', 'Onkar', 'Parth', 'Pranav', 'Prathamesh', 'Pratik', 'Rahul', 'Rohit', 'Rushikesh',
  'Sagar', 'Sahil', 'Sanket', 'Saurabh', 'Shubham', 'Siddharth', 'Suraj', 'Swapnil', 'Tejas', 'Tushar', 'Vaibhav', 'Vinayak', 'Vishal', 'Yash',
];
const FEMALE = [
  'Aditi', 'Ankita', 'Ashwini', 'Dipali', 'Gayatri', 'Kavita', 'Komal', 'Madhuri', 'Mrunal', 'Neha', 'Pooja', 'Pranali', 'Priya',
  'Rutuja', 'Sakshi', 'Sayali', 'Shruti', 'Snehal', 'Tejaswini', 'Vaishnavi',
];
const FATHERS = [
  'Arun', 'Ashok', 'Balasaheb', 'Bhausaheb', 'Bhimrao', 'Dattatray', 'Dilip', 'Dinkar', 'Dnyaneshwar', 'Eknath', 'Ganesh', 'Hanumant',
  'Kishor', 'Mahadev', 'Maruti', 'Milind', 'Mohan', 'Namdev', 'Nitin', 'Pandurang', 'Prakash', 'Rajendra', 'Rakesh', 'Ramdas', 'Ramesh',
  'Ravindra', 'Sachin', 'Sambhaji', 'Sanjay', 'Santosh', 'Shivaji', 'Subhash', 'Sunil', 'Suresh', 'Tukaram', 'Uday', 'Vijay', 'Vilas', 'Vitthal',
];
const SURNAMES = [
  'Ahire', 'Bagul', 'Bansode', 'Bhagat', 'Bhosale', 'Borse', 'Chaudhari', 'Chavan', 'Desai', 'Deshmukh', 'Dhumal', 'Gaikwad', 'Gholap',
  'Ghorpade', 'Gore', 'Hande', 'Jadhav', 'Jagtap', 'Joshi', 'Kadam', 'Kale', 'Kamble', 'Khandare', 'Kshirsagar', 'Kulkarni', 'Lokhande',
  'Londhe', 'Mahajan', 'Mane', 'More', 'Nikam', 'Nimbalkar', 'Patil', 'Pawar', 'Phadtare', 'Pingale', 'Rane', 'Salunkhe', 'Sathe',
  'Sawant', 'Shinde', 'Sonawane', 'Suryawanshi', 'Thorat', 'Tupe', 'Vaidya', 'Wagh', 'Waghmare', 'Yadav', 'Zende',
];

/** Names pinned to a roll number because demo scenarios refer to them. */
const PINNED: Readonly<Record<string, Readonly<Record<number, readonly [string, string]>>>> = {
  'ele-s1u1': { 21: ['Rahul Kumar', 'Suresh Kumar'] },
  'fit-s1u1': { 4: ['Kiran Wagh', 'Santosh Wagh'] },
};

function generatedRoster(batchId: string, size: number): Array<readonly [string, string]> {
  const random = createRandom(`roster:${batchId}`);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  const used = new Set<string>();
  const roster: Array<readonly [string, string]> = [];
  while (roster.length < size) {
    const surname = pick(SURNAMES);
    const first = random() < 0.3 ? pick(FEMALE) : pick(MALE);
    const name = `${first} ${surname}`;
    if (used.has(name)) continue;
    used.add(name);
    roster.push([name, `${pick(FATHERS)} ${surname}`]);
  }
  // Registers are alphabetical in ITIs; roll numbers follow the sorted order.
  roster.sort((a, b) => a[0].localeCompare(b[0]));
  const pinned = PINNED[batchId] ?? {};
  for (const [roll, pair] of Object.entries(pinned)) roster[Number(roll) - 1] = pair;
  return roster;
}

function rosterFor(batchId: string): ReadonlyArray<readonly [string, string]> {
  const size = BATCH_SIZES[batchId];
  if (batchId === 'ele-s1u2') return PROTOTYPE_ROSTER.slice(0, size);
  return generatedRoster(batchId, size);
}

export const STUDENTS: readonly Student[] = BATCHES.flatMap((batch) =>
  rosterFor(batch.id).map(([name, fatherName], i) => ({
    id: `${batch.id}-r${String(i + 1).padStart(2, '0')}`,
    batchId: batch.id,
    rollNo: i + 1,
    name,
    fatherName,
  })),
);
