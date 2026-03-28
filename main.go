package main

import "fmt"

type Human struct {
	Age int
}

func (h Human) printAge() {
	fmt.Println(h.Age)
}

type Student Human

func main() {
	var s = Student{Age: 10}
	fmt.Println(s.Age)

}
